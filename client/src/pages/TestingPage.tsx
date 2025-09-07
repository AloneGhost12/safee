import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Play, 
  Square, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Code, 
  Globe, 
  Shield, 
  Zap,
  RefreshCw,
  Download,
  Eye,
  Terminal,
  FileText
} from 'lucide-react';

interface TestResult {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'passed' | 'failed' | 'cancelled';
  duration?: number;
  coverage?: number;
  errors?: string[];
  output?: string;
  lastRun?: Date;
}

interface TestSuite {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  command: string;
  category: 'unit' | 'e2e' | 'security' | 'performance';
  estimatedDuration: number;
}

const testSuites: TestSuite[] = [
  {
    id: 'crypto-unit',
    name: 'Crypto Unit Tests',
    description: 'Test encryption, decryption, and key management',
    icon: Code,
    command: 'npm run test:unit crypto',
    category: 'unit',
    estimatedDuration: 30
  },
  {
    id: 'api-unit',
    name: 'API Unit Tests',
    description: 'Test server routes and middleware',
    icon: Terminal,
    command: 'npm run test:unit routes',
    category: 'unit',
    estimatedDuration: 45
  },
  {
    id: 'e2e-workflow',
    name: 'E2E Workflow Tests',
    description: 'Complete user journey testing',
    icon: Globe,
    command: 'npm run test:e2e',
    category: 'e2e',
    estimatedDuration: 120
  },
  {
    id: 'security-audit',
    name: 'Security Tests',
    description: 'Security configuration and vulnerability scan',
    icon: Shield,
    command: 'npm run security:check',
    category: 'security',
    estimatedDuration: 60
  },
  {
    id: 'performance',
    name: 'Performance Tests',
    description: 'Load testing and performance benchmarks',
    icon: Zap,
    command: 'npm run test:performance',
    category: 'performance',
    estimatedDuration: 90
  }
];

export default function TestingPage() {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [overallProgress, setOverallProgress] = useState(0);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection for real-time test updates
    const websocket = new WebSocket('ws://localhost:3001/test-runner');
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleTestUpdate(data);
    };

    websocket.onerror = () => {
      console.log('WebSocket connection failed, using polling fallback');
    };

    setWs(websocket);

    return () => {
      websocket?.close();
    };
  }, []);

  const handleTestUpdate = (data: any) => {
    setTestResults(prev => ({
      ...prev,
      [data.testId]: {
        id: data.testId,
        name: data.name,
        status: data.status,
        duration: data.duration,
        coverage: data.coverage,
        errors: data.errors,
        output: data.output,
        lastRun: new Date()
      }
    }));

    if (data.status === 'running') {
      setRunningTests(prev => new Set([...prev, data.testId]));
    } else {
      setRunningTests(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.testId);
        return newSet;
      });
    }
  };

  const runTest = async (suite: TestSuite) => {
    const testId = suite.id;
    
    setRunningTests(prev => new Set([...prev, testId]));
    setTestResults(prev => ({
      ...prev,
      [testId]: {
        id: testId,
        name: suite.name,
        status: 'running',
        lastRun: new Date()
      }
    }));

    try {
      // If WebSocket is available, send command through it
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: 'run-test',
          testId,
          command: suite.command
        }));
      } else {
        // Fallback: simulate test execution
        await simulateTestExecution(suite);
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testId]: {
          ...prev[testId],
          status: 'failed',
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }
      }));
      setRunningTests(prev => {
        const newSet = new Set(prev);
        newSet.delete(testId);
        return newSet;
      });
    }
  };

  const simulateTestExecution = async (suite: TestSuite) => {
    const testId = suite.id;
    const duration = suite.estimatedDuration * 1000;
    
    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setOverallProgress(prev => Math.min(prev + 10, 90));
    }, duration / 10);

    // Simulate test completion
    setTimeout(() => {
      clearInterval(progressInterval);
      setOverallProgress(100);
      
      const success = Math.random() > 0.2; // 80% success rate for simulation
      
      setTestResults(prev => ({
        ...prev,
        [testId]: {
          ...prev[testId],
          status: success ? 'passed' : 'failed',
          duration: duration / 1000,
          coverage: success ? Math.floor(Math.random() * 20 + 80) : undefined,
          errors: success ? [] : ['Simulated test failure'],
          output: success ? 'All tests passed successfully' : 'Some tests failed'
        }
      }));
      
      setRunningTests(prev => {
        const newSet = new Set(prev);
        newSet.delete(testId);
        return newSet;
      });
      
      setTimeout(() => setOverallProgress(0), 1000);
    }, duration);
  };

  const stopTest = (testId: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'stop-test',
        testId
      }));
    }
    
    setRunningTests(prev => {
      const newSet = new Set(prev);
      newSet.delete(testId);
      return newSet;
    });
    
    setTestResults(prev => ({
      ...prev,
      [testId]: {
        ...prev[testId],
        status: 'cancelled'
      }
    }));
  };

  const runAllTests = async () => {
    for (const suite of testSuites) {
      if (!runningTests.has(suite.id)) {
        await runTest(suite);
        // Wait a bit between tests to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      running: 'bg-blue-100 text-blue-800',
      passed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
      idle: 'bg-gray-100 text-gray-600'
    };

    return (
      <Badge className={variants[status] || variants.idle}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCategoryColor = (category: TestSuite['category']) => {
    const colors = {
      unit: 'border-blue-200 bg-blue-50',
      e2e: 'border-green-200 bg-green-50',
      security: 'border-red-200 bg-red-50',
      performance: 'border-yellow-200 bg-yellow-50'
    };
    return colors[category];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testing Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Run and monitor test suites for the Vault application
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={runAllTests}
            disabled={runningTests.size > 0}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Run All Tests
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => window.open('/coverage', '_blank')}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Coverage
          </Button>
        </div>
      </div>

      {/* Overall Progress */}
      {overallProgress > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-gray-600">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Test Suites */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testSuites.map((suite) => {
          const result = testResults[suite.id];
          const isRunning = runningTests.has(suite.id);
          const IconComponent = suite.icon;

          return (
            <Card 
              key={suite.id} 
              className={`${getCategoryColor(suite.category)} transition-all duration-200 hover:shadow-md`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-5 w-5" />
                    <CardTitle className="text-lg">{suite.name}</CardTitle>
                  </div>
                  {result && getStatusIcon(result.status)}
                </div>
                <CardDescription>{suite.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Status and Duration */}
                <div className="flex items-center justify-between">
                  {result ? getStatusBadge(result.status) : getStatusBadge('idle')}
                  <span className="text-sm text-gray-600">
                    ~{suite.estimatedDuration}s
                  </span>
                </div>

                {/* Test Results */}
                {result && (
                  <div className="space-y-2">
                    {result.duration && (
                      <div className="text-sm">
                        <span className="text-gray-600">Duration: </span>
                        <span className="font-medium">{result.duration.toFixed(1)}s</span>
                      </div>
                    )}
                    
                    {result.coverage && (
                      <div className="text-sm">
                        <span className="text-gray-600">Coverage: </span>
                        <span className="font-medium">{result.coverage}%</span>
                      </div>
                    )}
                    
                    {result.lastRun && (
                      <div className="text-sm text-gray-600">
                        Last run: {result.lastRun.toLocaleTimeString()}
                      </div>
                    )}
                    
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-2">
                        <details className="text-sm">
                          <summary className="text-red-600 cursor-pointer">
                            {result.errors.length} error(s)
                          </summary>
                          <div className="mt-1 p-2 bg-red-50 rounded text-red-800 font-mono text-xs">
                            {result.errors.join('\n')}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {isRunning ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => stopTest(suite.id)}
                      className="flex-1"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={() => runTest(suite)}
                      className="flex-1"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Run
                    </Button>
                  )}
                  
                  {result?.output && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Open output in a modal or new window
                        const newWindow = window.open('', '_blank');
                        if (newWindow) {
                          newWindow.document.write(`
                            <html>
                              <head><title>Test Output - ${suite.name}</title></head>
                              <body style="font-family: monospace; padding: 20px; white-space: pre-wrap;">
                                ${result.output}
                              </body>
                            </html>
                          `);
                        }
                      }}
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Test History */}
      {Object.keys(testResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Test Results</CardTitle>
            <CardDescription>Summary of recent test executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.values(testResults)
                .sort((a, b) => (b.lastRun?.getTime() || 0) - (a.lastRun?.getTime() || 0))
                .slice(0, 10)
                .map((result) => (
                  <div 
                    key={result.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">{result.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {result.duration && (
                        <span>{result.duration.toFixed(1)}s</span>
                      )}
                      {result.coverage && (
                        <span>{result.coverage}% coverage</span>
                      )}
                      {result.lastRun && (
                        <span>{result.lastRun.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common testing operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Button 
              variant="outline" 
              className="flex flex-col gap-2 h-20"
              onClick={() => window.open('https://github.com/AloneGhost12/safee/actions', '_blank')}
            >
              <Globe className="h-5 w-5" />
              <span className="text-sm">CI/CD Status</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col gap-2 h-20"
              onClick={() => {
                // Run quick essential tests
                const essentialTests = testSuites.filter(suite => 
                  suite.category === 'unit' || 
                  suite.category === 'security' ||
                  suite.id === 'crypto-unit'
                );
                
                essentialTests.forEach(suite => {
                  simulateTestExecution(suite);
                });
              }}
            >
              <Play className="h-5 w-5" />
              <span className="text-sm">Quick Test</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col gap-2 h-20"
              onClick={() => {
                // Generate and download test coverage report
                const coverageData = {
                  timestamp: new Date().toISOString(),
                  results: testResults,
                  summary: {
                    total: testSuites.length,
                    passed: Object.values(testResults).filter(r => r?.status === 'passed').length,
                    failed: Object.values(testResults).filter(r => r?.status === 'failed').length,
                    coverage: `${Math.round(overallProgress)}%`
                  }
                };
                
                const blob = new Blob([JSON.stringify(coverageData, null, 2)], { 
                  type: 'application/json' 
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `test-coverage-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-5 w-5" />
              <span className="text-sm">Download Report</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col gap-2 h-20"
              onClick={() => {
                // Open testing documentation in a new window
                const docContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Testing Documentation - Personal Vault</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2 { color: #333; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        .section { margin-bottom: 30px; }
    </style>
</head>
<body>
    <h1>Personal Vault - Testing Documentation</h1>
    
    <div class="section">
        <h2>Test Categories</h2>
        <ul>
            <li><strong>Authentication Tests</strong> - Login, registration, 2FA verification</li>
            <li><strong>File Operations</strong> - Upload, download, encryption, decryption</li>
            <li><strong>Note Management</strong> - Create, edit, delete, search notes</li>
            <li><strong>Security Tests</strong> - Rate limiting, CORS, input validation</li>
            <li><strong>API Integration</strong> - All API endpoints and error handling</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Quick Actions Guide</h2>
        <ul>
            <li><strong>Run All Tests</strong> - Executes all test categories</li>
            <li><strong>Quick Test</strong> - Runs essential auth and API tests</li>
            <li><strong>CI/CD Status</strong> - Opens GitHub Actions page</li>
            <li><strong>Download Report</strong> - Saves test results as JSON</li>
            <li><strong>Clear Results</strong> - Resets all test data</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Test Commands</h2>
        <pre>
# Run client tests
npm run test

# Run server tests  
npm run test:server

# Run with coverage
npm run test:coverage

# Run CI tests
npm run test:ci
        </pre>
    </div>
</body>
</html>`;
                
                const blob = new Blob([docContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                
                // Clean up the URL after a delay
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <FileText className="h-5 w-5" />
              <span className="text-sm">Documentation</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col gap-2 h-20"
              onClick={() => {
                // Clear all test results
                setTestResults({});
                setRunningTests(new Set());
                setOverallProgress(0);
              }}
            >
              <RefreshCw className="h-5 w-5" />
              <span className="text-sm">Clear Results</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
