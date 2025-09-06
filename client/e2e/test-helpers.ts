import { Page, expect } from '@playwright/test';

/**
 * Test utilities and helper functions for Playwright e2e tests
 */

export class TestUser {
  constructor(
    public email: string,
    public password: string,
    public name?: string
  ) {}
}

export const TEST_USERS = {
  standard: new TestUser('e2e-test@example.com', 'Test123!@#E2E', 'E2E Test User'),
  admin: new TestUser('e2e-admin@example.com', 'Admin123!@#E2E', 'E2E Admin User'),
  newUser: new TestUser('new-user-e2e@example.com', 'NewUser123!@#', 'New E2E User')
};

export const TEST_DATA = {
  notes: {
    simple: {
      title: 'Test Note',
      content: 'This is a test note for e2e testing'
    },
    encrypted: {
      title: 'Secret Note 🔒',
      content: 'This is a secret note with sensitive information: password123, credit card 1234-5678-9012-3456'
    },
    longContent: {
      title: 'Long Content Note',
      content: 'Lorem ipsum dolor sit amet, '.repeat(100) // Long content for testing
    }
  },
  files: {
    testDocument: {
      name: 'test-document.pdf',
      path: './e2e/fixtures/test-document.pdf',
      type: 'application/pdf'
    },
    testImage: {
      name: 'test-image.jpg',
      path: './e2e/fixtures/test-image.jpg', 
      type: 'image/jpeg'
    }
  }
};

/**
 * Authentication helpers
 */
export class AuthHelper {
  constructor(private page: Page) {}

  async register(user: TestUser): Promise<void> {
    await this.page.goto('/register');
    await this.page.waitForLoadState('networkidle');
    
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    await this.page.fill('[data-testid="confirm-password-input"]', user.password);
    
    // Click register button
    await this.page.click('[data-testid="register-button"]');
    
    // Wait for successful registration
    await expect(this.page.locator('[data-testid="success-message"]')).toBeVisible();
  }

  async login(user: TestUser): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
    
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    
    // Click login button
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for redirect to vault or 2FA page
    await Promise.race([
      this.page.waitForURL('/vault'),
      this.page.waitForURL('/2fa-verify')
    ]);
  }

  async enable2FA(): Promise<string> {
    // Navigate to settings or security page
    await this.page.goto('/settings');
    
    // Click enable 2FA button
    await this.page.click('[data-testid="enable-2fa-button"]');
    
    // Wait for QR code and secret
    await expect(this.page.locator('[data-testid="qr-code"]')).toBeVisible();
    
    // Extract the secret from the page
    const secret = await this.page.textContent('[data-testid="2fa-secret"]');
    expect(secret).toBeTruthy();
    
    return secret!;
  }

  async verify2FA(code: string): Promise<void> {
    await this.page.fill('[data-testid="2fa-code-input"]', code);
    await this.page.click('[data-testid="verify-2fa-button"]');
    
    // Wait for successful verification
    await expect(this.page.locator('[data-testid="2fa-success"]')).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.page.click('[data-testid="user-menu-button"]');
    await this.page.click('[data-testid="logout-button"]');
    
    // Wait for redirect to login page
    await this.page.waitForURL('/login');
  }
}

/**
 * Notes helpers
 */
export class NotesHelper {
  constructor(private page: Page) {}

  async createNote(note: { title: string; content: string }): Promise<string> {
    await this.page.goto('/vault');
    
    // Click create note button
    await this.page.click('[data-testid="create-note-button"]');
    
    // Fill note details
    await this.page.fill('[data-testid="note-title-input"]', note.title);
    await this.page.fill('[data-testid="note-content-input"]', note.content);
    
    // Save note
    await this.page.click('[data-testid="save-note-button"]');
    
    // Wait for note to be saved
    await expect(this.page.locator('[data-testid="note-saved-indicator"]')).toBeVisible();
    
    // Get the note ID from URL or data attribute
    const noteId = await this.page.getAttribute('[data-testid="current-note"]', 'data-note-id');
    expect(noteId).toBeTruthy();
    
    return noteId!;
  }

  async editNote(noteId: string, updates: Partial<{ title: string; content: string }>): Promise<void> {
    // Click on the note to select it
    await this.page.click(`[data-testid="note-item-${noteId}"]`);
    
    // Edit the note
    if (updates.title) {
      await this.page.fill('[data-testid="note-title-input"]', updates.title);
    }
    
    if (updates.content) {
      await this.page.fill('[data-testid="note-content-input"]', updates.content);
    }
    
    // Save changes
    await this.page.click('[data-testid="save-note-button"]');
    
    // Wait for save confirmation
    await expect(this.page.locator('[data-testid="note-saved-indicator"]')).toBeVisible();
  }

  async deleteNote(noteId: string): Promise<void> {
    // Right-click on note or click delete button
    await this.page.click(`[data-testid="note-item-${noteId}"]`);
    await this.page.click('[data-testid="delete-note-button"]');
    
    // Confirm deletion
    await this.page.click('[data-testid="confirm-delete-button"]');
    
    // Wait for note to be removed
    await expect(this.page.locator(`[data-testid="note-item-${noteId}"]`)).not.toBeVisible();
  }

  async restoreNote(noteId: string): Promise<void> {
    // Go to trash page
    await this.page.goto('/trash');
    
    // Find and restore the note
    await this.page.click(`[data-testid="restore-note-${noteId}"]`);
    
    // Wait for restoration confirmation
    await expect(this.page.locator('[data-testid="note-restored-message"]')).toBeVisible();
  }

  async exportNotes(): Promise<void> {
    await this.page.goto('/settings');
    
    // Click export button
    await this.page.click('[data-testid="export-notes-button"]');
    
    // Wait for download to start
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click('[data-testid="confirm-export-button"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('vault-export');
  }
}

/**
 * File helpers
 */
export class FilesHelper {
  constructor(private page: Page) {}

  async uploadFile(filePath: string): Promise<string> {
    await this.page.goto('/files');
    
    // Set up file chooser handler
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await this.page.click('[data-testid="upload-file-button"]');
    
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    
    // Wait for upload to complete
    await expect(this.page.locator('[data-testid="upload-success"]')).toBeVisible();
    
    // Get file ID
    const fileId = await this.page.getAttribute('[data-testid="uploaded-file"]:last-child', 'data-file-id');
    expect(fileId).toBeTruthy();
    
    return fileId!;
  }

  async downloadFile(fileId: string): Promise<void> {
    await this.page.goto('/files');
    
    // Start download
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click(`[data-testid="download-file-${fileId}"]`);
    
    const download = await downloadPromise;
    expect(download).toBeTruthy();
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.page.goto('/files');
    
    // Delete file
    await this.page.click(`[data-testid="delete-file-${fileId}"]`);
    await this.page.click('[data-testid="confirm-delete-button"]');
    
    // Wait for deletion confirmation
    await expect(this.page.locator(`[data-testid="file-item-${fileId}"]`)).not.toBeVisible();
  }
}

/**
 * Navigation helpers
 */
export class NavigationHelper {
  constructor(private page: Page) {}

  async goToVault(): Promise<void> {
    await this.page.goto('/vault');
    await this.page.waitForLoadState('networkidle');
  }

  async goToFiles(): Promise<void> {
    await this.page.goto('/files');
    await this.page.waitForLoadState('networkidle');
  }

  async goToSettings(): Promise<void> {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
  }

  async goToTrash(): Promise<void> {
    await this.page.goto('/trash');
    await this.page.waitForLoadState('networkidle');
  }

  async refresh(): Promise<void> {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }
}

/**
 * Assertion helpers
 */
export class AssertionHelper {
  constructor(private page: Page) {}

  async expectNoteExists(noteId: string): Promise<void> {
    await expect(this.page.locator(`[data-testid="note-item-${noteId}"]`)).toBeVisible();
  }

  async expectNoteContent(noteId: string, expectedTitle: string, expectedContent: string): Promise<void> {
    await this.page.click(`[data-testid="note-item-${noteId}"]`);
    
    await expect(this.page.locator('[data-testid="note-title-input"]')).toHaveValue(expectedTitle);
    await expect(this.page.locator('[data-testid="note-content-input"]')).toHaveValue(expectedContent);
  }

  async expectFileExists(fileId: string): Promise<void> {
    await expect(this.page.locator(`[data-testid="file-item-${fileId}"]`)).toBeVisible();
  }

  async expectUserLoggedIn(): Promise<void> {
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  async expectUserLoggedOut(): Promise<void> {
    await expect(this.page.locator('[data-testid="login-form"]')).toBeVisible();
  }
}

/**
 * Wait helpers
 */
export class WaitHelper {
  constructor(private page: Page) {}

  async waitForApiCall(url: string): Promise<void> {
    await this.page.waitForResponse(resp => resp.url().includes(url) && resp.status() === 200);
  }

  async waitForElement(selector: string, timeout = 5000): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
  }

  async waitForNavigation(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}

/**
 * Test helper factory
 */
export class TestHelpers {
  public auth: AuthHelper;
  public notes: NotesHelper;
  public files: FilesHelper;
  public navigation: NavigationHelper;
  public assertions: AssertionHelper;
  public wait: WaitHelper;

  constructor(page: Page) {
    this.auth = new AuthHelper(page);
    this.notes = new NotesHelper(page);
    this.files = new FilesHelper(page);
    this.navigation = new NavigationHelper(page);
    this.assertions = new AssertionHelper(page);
    this.wait = new WaitHelper(page);
  }
}
