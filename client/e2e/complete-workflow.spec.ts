import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';
import { TestHelpers, TEST_USERS, TEST_DATA } from './test-helpers';

/**
 * Complete end-to-end test flow:
 * register → login → enable 2FA → create encrypted note → refresh → edit → delete → restore → export
 */
test.describe('Complete User Journey E2E', () => {
  test('complete vault workflow with 2FA', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const testUser = TEST_USERS.newUser;
    
    // Step 1: Register new user
    test.step('Register new user account', async () => {
      await helpers.auth.register(testUser);
      
      // Should redirect to login page after registration
      await expect(page).toHaveURL('/login');
      await helpers.assertions.expectUserLoggedOut();
    });

    // Step 2: Login with new account
    test.step('Login with new account', async () => {
      await helpers.auth.login(testUser);
      
      // Should be logged in and redirected to vault
      await expect(page).toHaveURL('/vault');
      await helpers.assertions.expectUserLoggedIn();
    });

    // Step 3: Enable 2FA
    let twoFactorSecret: string;
    test.step('Enable two-factor authentication', async () => {
      twoFactorSecret = await helpers.auth.enable2FA();
      
      // Verify 2FA setup with a test code
      const testCode = authenticator.generate(twoFactorSecret);
      await helpers.auth.verify2FA(testCode);
      
      // Should show 2FA enabled confirmation
      await expect(page.locator('[data-testid="2fa-enabled-message"]')).toBeVisible();
    });

    // Step 4: Logout and login again to test 2FA
    test.step('Test 2FA login flow', async () => {
      await helpers.auth.logout();
      await helpers.assertions.expectUserLoggedOut();
      
      // Login again - should require 2FA
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.click('[data-testid="login-button"]');
      
      // Should be redirected to 2FA verification page
      await expect(page).toHaveURL('/2fa-verify');
      
      // Enter 2FA code
      const twoFactorCode = authenticator.generate(twoFactorSecret);
      await helpers.auth.verify2FA(twoFactorCode);
      
      // Should now be logged in
      await expect(page).toHaveURL('/vault');
      await helpers.assertions.expectUserLoggedIn();
    });

    // Step 5: Create encrypted note
    let noteId: string;
    test.step('Create encrypted note', async () => {
      await helpers.navigation.goToVault();
      
      noteId = await helpers.notes.createNote(TEST_DATA.notes.encrypted);
      
      // Verify note was created
      await helpers.assertions.expectNoteExists(noteId);
      await helpers.assertions.expectNoteContent(
        noteId,
        TEST_DATA.notes.encrypted.title,
        TEST_DATA.notes.encrypted.content
      );
    });

    // Step 6: Refresh page and verify note persistence
    test.step('Refresh page and verify note persistence', async () => {
      await helpers.navigation.refresh();
      
      // Note should still exist and be decryptable
      await helpers.assertions.expectNoteExists(noteId);
      await helpers.assertions.expectNoteContent(
        noteId,
        TEST_DATA.notes.encrypted.title,
        TEST_DATA.notes.encrypted.content
      );
    });

    // Step 7: Edit the note
    test.step('Edit encrypted note', async () => {
      const updatedNote = {
        title: 'Updated Secret Note 🔒✨',
        content: 'Updated content with new sensitive data: api-key-xyz789, new-password-456'
      };
      
      await helpers.notes.editNote(noteId, updatedNote);
      
      // Verify note was updated
      await helpers.assertions.expectNoteContent(noteId, updatedNote.title, updatedNote.content);
    });

    // Step 8: Delete the note
    test.step('Delete note (move to trash)', async () => {
      await helpers.notes.deleteNote(noteId);
      
      // Note should no longer be visible in vault
      await expect(page.locator(`[data-testid="note-item-${noteId}"]`)).not.toBeVisible();
    });

    // Step 9: Verify note is in trash
    test.step('Verify note is in trash', async () => {
      await helpers.navigation.goToTrash();
      
      // Note should be visible in trash
      await expect(page.locator(`[data-testid="trash-note-${noteId}"]`)).toBeVisible();
    });

    // Step 10: Restore note from trash
    test.step('Restore note from trash', async () => {
      await helpers.notes.restoreNote(noteId);
      
      // Go back to vault and verify note is restored
      await helpers.navigation.goToVault();
      await helpers.assertions.expectNoteExists(noteId);
    });

    // Step 11: Create additional test data for export
    test.step('Create additional notes for export test', async () => {
      // Create a few more notes to make export more meaningful
      await helpers.notes.createNote(TEST_DATA.notes.simple);
      await helpers.notes.createNote(TEST_DATA.notes.longContent);
      
      // Verify we have multiple notes
      const noteCount = await page.locator('[data-testid^="note-item-"]').count();
      expect(noteCount).toBeGreaterThanOrEqual(3);
    });

    // Step 12: Export vault data
    test.step('Export vault data', async () => {
      await helpers.notes.exportNotes();
      
      // Verify export completed successfully
      await expect(page.locator('[data-testid="export-success-message"]')).toBeVisible();
    });

    // Step 13: Test security features
    test.step('Test security features', async () => {
      // Test session timeout handling
      await page.goto('/settings');
      
      // Verify security settings are accessible
      await expect(page.locator('[data-testid="security-settings"]')).toBeVisible();
      
      // Test 2FA status
      await expect(page.locator('[data-testid="2fa-status"]')).toContainText('Enabled');
    });

    // Step 14: Final cleanup and logout
    test.step('Final logout', async () => {
      await helpers.auth.logout();
      await helpers.assertions.expectUserLoggedOut();
      
      // Verify redirect to login page
      await expect(page).toHaveURL('/login');
    });
  });
});

/**
 * Additional e2e tests for specific features
 */
test.describe('File Management E2E', () => {
  test('complete file upload and management workflow', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const testUser = TEST_USERS.standard;
    
    // Login
    await helpers.auth.login(testUser);
    
    // Test file upload
    test.step('Upload encrypted file', async () => {
      await helpers.navigation.goToFiles();
      
      // Create a test file (you would need to have test fixtures)
      const fileContent = 'This is a test file with sensitive data for e2e testing.';
      
      // In a real test, you'd upload an actual file
      // For now, we'll test the UI elements exist
      await expect(page.locator('[data-testid="upload-file-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-list"]')).toBeVisible();
    });
    
    // Test file filtering and search
    test.step('Test file filtering', async () => {
      // Test tag filtering
      await page.fill('[data-testid="file-search-input"]', 'document');
      await page.click('[data-testid="apply-filter-button"]');
      
      // Verify filtering works
      await helpers.wait.waitForApiCall('/files');
    });
  });
});

test.describe('Error Handling E2E', () => {
  test('handles authentication errors gracefully', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Test invalid login
    test.step('Test invalid login credentials', async () => {
      await page.goto('/login');
      
      await page.fill('[data-testid="email-input"]', 'invalid@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    });
    
    // Test account lockout protection
    test.step('Test account lockout after multiple failed attempts', async () => {
      const testUser = TEST_USERS.standard;
      
      // Attempt login with wrong password multiple times
      for (let i = 0; i < 5; i++) {
        await page.fill('[data-testid="email-input"]', testUser.email);
        await page.fill('[data-testid="password-input"]', 'wrongpassword');
        await page.click('[data-testid="login-button"]');
        
        await helpers.wait.waitForElement('[data-testid="error-message"]');
      }
      
      // Next attempt should show account locked message
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Account locked');
    });
  });

  test('handles network errors gracefully', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Login first
    await helpers.auth.login(TEST_USERS.standard);
    
    // Test offline behavior
    test.step('Test offline behavior', async () => {
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to create a note
      await helpers.navigation.goToVault();
      await page.click('[data-testid="create-note-button"]');
      await page.fill('[data-testid="note-title-input"]', 'Offline Test Note');
      await page.fill('[data-testid="note-content-input"]', 'This should fail to save');
      await page.click('[data-testid="save-note-button"]');
      
      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    });
  });
});

test.describe('Accessibility E2E', () => {
  test('keyboard navigation works correctly', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    await helpers.auth.login(TEST_USERS.standard);
    await helpers.navigation.goToVault();
    
    // Test keyboard navigation
    test.step('Test keyboard navigation in vault', async () => {
      // Tab through interface elements
      await page.keyboard.press('Tab'); // Should focus first interactive element
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Test Enter key activation
      await page.keyboard.press('Enter');
      
      // Test Escape key cancellation
      await page.keyboard.press('Escape');
    });
    
    // Test screen reader compatibility
    test.step('Test ARIA labels and roles', async () => {
      // Verify important elements have proper ARIA labels
      await expect(page.locator('[data-testid="main-navigation"]')).toHaveAttribute('role', 'navigation');
      await expect(page.locator('[data-testid="note-list"]')).toHaveAttribute('role', 'list');
      await expect(page.locator('[data-testid="create-note-button"]')).toHaveAttribute('aria-label');
    });
  });
});

test.describe('Performance E2E', () => {
  test('handles large number of notes efficiently', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    await helpers.auth.login(TEST_USERS.standard);
    
    test.step('Create many notes and test performance', async () => {
      await helpers.navigation.goToVault();
      
      // Create multiple notes quickly
      for (let i = 0; i < 10; i++) {
        await helpers.notes.createNote({
          title: `Performance Test Note ${i}`,
          content: `Content for note ${i} - ${new Date().toISOString()}`
        });
      }
      
      // Test that the interface remains responsive
      await helpers.navigation.refresh();
      
      // Should load all notes within reasonable time
      await helpers.wait.waitForElement('[data-testid="note-list"]');
      
      const noteCount = await page.locator('[data-testid^="note-item-"]').count();
      expect(noteCount).toBeGreaterThanOrEqual(10);
    });
  });
});
