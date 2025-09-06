import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface TestProcess {
  id: string;
  process: ChildProcess;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  output: string[];
}

export class TestRunner {
  private wss: WebSocketServer;
  private activeTests: Map<string, TestProcess> = new Map();

  constructor(server: any) {
    this.wss = new WebSocketServer({ server, path: '/test-runner' });
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Test runner client connected');

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Test runner client disconnected');
      });

      // Send current test status on connection
      this.sendTestStatus(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: any) {
    switch (message.action) {
      case 'run-test':
        this.runTest(message.testId, message.command);
        break;
      case 'stop-test':
        this.stopTest(message.testId);
        break;
      case 'get-status':
        this.sendTestStatus(ws);
        break;
    }
  }

  private runTest(testId: string, command: string) {
    if (this.activeTests.has(testId)) {
      console.log(`Test ${testId} is already running`);
      return;
    }

    console.log(`Starting test: ${testId} with command: ${command}`);

    // Parse command and arguments
    const [cmd, ...args] = command.split(' ');
    const isNpmCommand = cmd === 'npm';
    
    let finalCmd = cmd;
    let finalArgs = args;
    
    if (isNpmCommand) {
      // For npm commands, we need to handle them properly on Windows
      finalCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      finalArgs = args;
    }

    // Determine working directory based on test type
    const workingDir = this.getWorkingDirectory(testId);

    const testProcess = spawn(finalCmd, finalArgs, {
      cwd: workingDir,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const testData: TestProcess = {
      id: testId,
      process: testProcess,
      status: 'running',
      startTime: new Date(),
      output: []
    };

    this.activeTests.set(testId, testData);

    // Broadcast test start
    this.broadcast({
      type: 'test-update',
      testId,
      status: 'running',
      startTime: testData.startTime
    });

    // Handle process output
    testProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      testData.output.push(output);
      
      this.broadcast({
        type: 'test-output',
        testId,
        output: output,
        timestamp: new Date()
      });

      // Parse for coverage information
      this.parseCoverageInfo(testId, output);
    });

    testProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      testData.output.push(`ERROR: ${output}`);
      
      this.broadcast({
        type: 'test-output',
        testId,
        output: `ERROR: ${output}`,
        timestamp: new Date()
      });
    });

    // Handle process completion
    testProcess.on('close', (code: number) => {
      const endTime = new Date();
      const duration = (endTime.getTime() - testData.startTime.getTime()) / 1000;
      const status = code === 0 ? 'completed' : 'failed';
      
      testData.status = status;
      
      this.broadcast({
        type: 'test-complete',
        testId,
        status,
        duration,
        exitCode: code,
        output: testData.output.join('\n'),
        endTime
      });

      // Clean up after a delay
      setTimeout(() => {
        this.activeTests.delete(testId);
      }, 5000);
    });

    testProcess.on('error', (error: Error) => {
      console.error(`Test process error for ${testId}:`, error);
      testData.status = 'failed';
      
      this.broadcast({
        type: 'test-error',
        testId,
        error: error.message,
        timestamp: new Date()
      });
    });
  }

  private stopTest(testId: string) {
    const testData = this.activeTests.get(testId);
    if (!testData) {
      return;
    }

    console.log(`Stopping test: ${testId}`);
    
    testData.process.kill('SIGTERM');
    testData.status = 'cancelled';

    this.broadcast({
      type: 'test-cancelled',
      testId,
      timestamp: new Date()
    });

    setTimeout(() => {
      this.activeTests.delete(testId);
    }, 1000);
  }

  private getWorkingDirectory(testId: string): string {
    const rootDir = path.resolve(__dirname, '../..');
    
    if (testId.includes('crypto') || testId.includes('e2e')) {
      return path.join(rootDir, 'client');
    } else if (testId.includes('api') || testId.includes('server')) {
      return path.join(rootDir, 'server');
    }
    
    return rootDir;
  }

  private parseCoverageInfo(testId: string, output: string) {
    // Parse coverage information from test output
    const coverageMatch = output.match(/All files\s+\|\s+([0-9.]+)/);
    if (coverageMatch) {
      const coverage = parseFloat(coverageMatch[1]);
      
      this.broadcast({
        type: 'coverage-update',
        testId,
        coverage,
        timestamp: new Date()
      });
    }

    // Parse test results
    const passMatch = output.match(/(\d+) passing/);
    const failMatch = output.match(/(\d+) failing/);
    
    if (passMatch || failMatch) {
      this.broadcast({
        type: 'test-results',
        testId,
        passing: passMatch ? parseInt(passMatch[1]) : 0,
        failing: failMatch ? parseInt(failMatch[1]) : 0,
        timestamp: new Date()
      });
    }
  }

  private sendTestStatus(ws: WebSocket) {
    const status = Array.from(this.activeTests.values()).map(test => ({
      id: test.id,
      status: test.status,
      startTime: test.startTime,
      output: test.output.slice(-10) // Last 10 lines
    }));

    ws.send(JSON.stringify({
      type: 'test-status',
      tests: status,
      timestamp: new Date()
    }));
  }

  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Public method to get test status for HTTP API
  public getActiveTests() {
    return Array.from(this.activeTests.values()).map(test => ({
      id: test.id,
      status: test.status,
      startTime: test.startTime,
      duration: test.status === 'running' 
        ? (Date.now() - test.startTime.getTime()) / 1000 
        : null
    }));
  }
}

// Express route handlers
export const testRoutes = express.Router();

let testRunner: TestRunner;

export function initializeTestRunner(server: any) {
  testRunner = new TestRunner(server);
}

testRoutes.get('/status', (req, res) => {
  if (!testRunner) {
    return res.status(503).json({ error: 'Test runner not initialized' });
  }
  
  res.json({
    activeTests: testRunner.getActiveTests(),
    timestamp: new Date()
  });
});

testRoutes.post('/run', (req, res) => {
  const { testId, command } = req.body;
  
  if (!testId || !command) {
    return res.status(400).json({ error: 'testId and command are required' });
  }
  
  if (!testRunner) {
    return res.status(503).json({ error: 'Test runner not initialized' });
  }
  
  // Validate command for security
  const allowedCommands = [
    'npm run test:unit',
    'npm run test:e2e',
    'npm run test:coverage',
    'npm run security:check',
    'npm run test:performance'
  ];
  
  const isAllowed = allowedCommands.some(allowed => command.startsWith(allowed));
  if (!isAllowed) {
    return res.status(400).json({ error: 'Command not allowed' });
  }
  
  try {
    testRunner['runTest'](testId, command);
    res.json({ message: 'Test started', testId });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to start test', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

testRoutes.post('/stop', (req, res) => {
  const { testId } = req.body;
  
  if (!testId) {
    return res.status(400).json({ error: 'testId is required' });
  }
  
  if (!testRunner) {
    return res.status(503).json({ error: 'Test runner not initialized' });
  }
  
  try {
    testRunner['stopTest'](testId);
    res.json({ message: 'Test stopped', testId });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to stop test', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default testRoutes;
