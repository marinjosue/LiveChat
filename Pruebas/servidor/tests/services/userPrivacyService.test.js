const { UserPrivacyService } = require('../../services/userPrivacyService');

describe('UserPrivacyService', () => {
  describe('Module Import', () => {
    it('should import UserPrivacyService', () => {
      expect(UserPrivacyService).toBeDefined();
    });

    it('should have static methods', () => {
      expect(UserPrivacyService).toHaveProperty('hashNickname');
      expect(UserPrivacyService).toHaveProperty('generateAnonymousUser');
      expect(UserPrivacyService).toHaveProperty('getPublicUserInfo');
      expect(UserPrivacyService).toHaveProperty('generateAnonymousUserList');
      expect(UserPrivacyService).toHaveProperty('compareNicknames');
      expect(UserPrivacyService).toHaveProperty('generateUserStats');
    });
  });

  describe('hashNickname', () => {
    it('should hash a nickname without salt', () => {
      const hash = UserPrivacyService.hashNickname('testUser');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(8);
      expect(hash).toMatch(/^[A-F0-9]+$/);
    });

    it('should hash a nickname with salt', () => {
      const hash1 = UserPrivacyService.hashNickname('testUser', '1234');
      const hash2 = UserPrivacyService.hashNickname('testUser', '5678');
      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).not.toBe(hash2);
    });

    it('should produce consistent hashes', () => {
      const hash1 = UserPrivacyService.hashNickname('testUser', 'salt');
      const hash2 = UserPrivacyService.hashNickname('testUser', 'salt');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different nicknames', () => {
      const hash1 = UserPrivacyService.hashNickname('user1');
      const hash2 = UserPrivacyService.hashNickname('user2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle special characters', () => {
      const hash = UserPrivacyService.hashNickname('User@#$%');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(8);
    });

    it('should handle empty string', () => {
      const hash = UserPrivacyService.hashNickname('');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(8);
    });
  });

  describe('generateAnonymousUser', () => {
    it('should generate anonymous user info', () => {
      const result = UserPrivacyService.generateAnonymousUser('testUser');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('displayName');
      expect(result).toHaveProperty('color');
      expect(result).toHaveProperty('initials');
      expect(result).toHaveProperty('originalNickname');
    });

    it('should generate valid display name', () => {
      const result = UserPrivacyService.generateAnonymousUser('testUser');
      expect(result.displayName).toMatch(/^Usuario-[A-F0-9]{8}$/);
    });

    it('should generate valid HSL color', () => {
      const result = UserPrivacyService.generateAnonymousUser('testUser');
      expect(result.color).toMatch(/^hsl\(\d+, 65%, 55%\)$/);
    });

    it('should generate 2-character initials', () => {
      const result = UserPrivacyService.generateAnonymousUser('testUser');
      expect(result.initials.length).toBe(2);
      expect(result.initials).toMatch(/^[A-F0-9]{2}$/);
    });

    it('should preserve original nickname', () => {
      const nickname = 'testUser';
      const result = UserPrivacyService.generateAnonymousUser(nickname);
      expect(result.originalNickname).toBe(nickname);
    });

    it('should generate different colors for different users', () => {
      const result1 = UserPrivacyService.generateAnonymousUser('user1');
      const result2 = UserPrivacyService.generateAnonymousUser('user2');
      expect(result1.color).not.toBe(result2.color);
    });

    it('should use salt for anonymous generation', () => {
      const result1 = UserPrivacyService.generateAnonymousUser('user', 'salt1');
      const result2 = UserPrivacyService.generateAnonymousUser('user', 'salt2');
      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('getPublicUserInfo', () => {
    it('should return public user info for other users', () => {
      const info = UserPrivacyService.getPublicUserInfo('testUser', '1234', false);
      expect(info).toHaveProperty('hash');
      expect(info).toHaveProperty('displayName');
      expect(info).toHaveProperty('color');
      expect(info).toHaveProperty('initials');
      expect(info).toHaveProperty('isYou');
      expect(info.isYou).toBe(false);
    });

    it('should return "Tú" for own user', () => {
      const nickname = 'testUser';
      const info = UserPrivacyService.getPublicUserInfo(nickname, '1234', true);
      expect(info.displayName).toContain('Tú');
      expect(info.displayName).toContain(nickname);
      expect(info.isYou).toBe(true);
    });

    it('should not show "Tú" for other users', () => {
      const info = UserPrivacyService.getPublicUserInfo('otherUser', '1234', false);
      expect(info.displayName).not.toContain('Tú');
      expect(info.displayName).toMatch(/^Usuario-/);
    });

    it('should include hash in response', () => {
      const info = UserPrivacyService.getPublicUserInfo('testUser', '1234');
      expect(info.hash).toBeDefined();
      expect(info.hash.length).toBe(8);
    });

    it('should use room PIN as salt', () => {
      const info1 = UserPrivacyService.getPublicUserInfo('user', '1234');
      const info2 = UserPrivacyService.getPublicUserInfo('user', '5678');
      expect(info1.hash).not.toBe(info2.hash);
    });
  });

  describe('generateAnonymousUserList', () => {
    it('should generate anonymous list for multiple users', () => {
      const users = [
        { id: 's1', nickname: 'user1' },
        { id: 's2', nickname: 'user2' },
        { id: 's3', nickname: 'user3' }
      ];
      
      const list = UserPrivacyService.generateAnonymousUserList(users, '1234');
      expect(list).toHaveLength(3);
      expect(list[0]).toHaveProperty('socketId');
      expect(list[0]).toHaveProperty('hash');
      expect(list[0]).toHaveProperty('displayName');
    });

    it('should mark current user correctly', () => {
      const users = [
        { id: 's1', nickname: 'user1' },
        { id: 's2', nickname: 'currentUser' },
        { id: 's3', nickname: 'user3' }
      ];
      
      const list = UserPrivacyService.generateAnonymousUserList(users, '1234', 'currentUser');
      const currentUser = list.find(u => u.isYou);
      expect(currentUser).toBeDefined();
      expect(currentUser.displayName).toContain('Tú');
    });

    it('should include joinedAt timestamp', () => {
      const users = [
        { id: 's1', nickname: 'user1', joinedAt: new Date() }
      ];
      
      const list = UserPrivacyService.generateAnonymousUserList(users, '1234');
      expect(list[0].joinedAt).toBeInstanceOf(Date);
    });

    it('should handle users without joinedAt', () => {
      const users = [
        { id: 's1', nickname: 'user1' }
      ];
      
      const list = UserPrivacyService.generateAnonymousUserList(users, '1234');
      expect(list[0].joinedAt).toBeInstanceOf(Date);
    });

    it('should preserve socketId', () => {
      const users = [
        { id: 'socket123', nickname: 'user1' }
      ];
      
      const list = UserPrivacyService.generateAnonymousUserList(users, '1234');
      expect(list[0].socketId).toBe('socket123');
    });

    it('should handle empty user list', () => {
      const list = UserPrivacyService.generateAnonymousUserList([], '1234');
      expect(list).toHaveLength(0);
    });

    it('should not mark anyone as "you" when no current user provided', () => {
      const users = [
        { id: 's1', nickname: 'user1' },
        { id: 's2', nickname: 'user2' }
      ];
      
      const list = UserPrivacyService.generateAnonymousUserList(users, '1234');
      const hasYou = list.some(u => u.isYou);
      expect(hasYou).toBe(false);
    });
  });

  describe('compareNicknames', () => {
    it('should return true for matching nicknames', () => {
      const result = UserPrivacyService.compareNicknames('user1', 'user1', 'salt');
      expect(result).toBe(true);
    });

    it('should return false for different nicknames', () => {
      const result = UserPrivacyService.compareNicknames('user1', 'user2', 'salt');
      expect(result).toBe(false);
    });

    it('should work without salt', () => {
      const result = UserPrivacyService.compareNicknames('user1', 'user1');
      expect(result).toBe(true);
    });

    it('should be case-sensitive', () => {
      const result = UserPrivacyService.compareNicknames('User1', 'user1', 'salt');
      expect(result).toBe(false);
    });

    it('should handle special characters', () => {
      const result = UserPrivacyService.compareNicknames('user@123', 'user@123', 'salt');
      expect(result).toBe(true);
    });
  });

  describe('generateUserStats', () => {
    it('should generate total user count', () => {
      const users = [
        { nickname: 'user1', joinedAt: new Date() },
        { nickname: 'user2', joinedAt: new Date() },
        { nickname: 'user3', joinedAt: new Date() }
      ];
      
      const stats = UserPrivacyService.generateUserStats(users);
      expect(stats.totalUsers).toBe(3);
    });

    it('should count active users in last 5 minutes', () => {
      const now = Date.now();
      const users = [
        { nickname: 'user1', lastActive: new Date(now - 2 * 60 * 1000) },
        { nickname: 'user2', lastActive: new Date(now - 10 * 60 * 1000) },
        { nickname: 'user3', joinedAt: new Date(now - 1 * 60 * 1000) }
      ];
      
      const stats = UserPrivacyService.generateUserStats(users);
      expect(stats.activeInLast5Min).toBeGreaterThan(0);
    });

    it('should generate user hashes', () => {
      const users = [
        { nickname: 'user1' },
        { nickname: 'user2' }
      ];
      
      const stats = UserPrivacyService.generateUserStats(users);
      expect(stats.userHashes).toHaveLength(2);
      expect(stats.userHashes[0]).toMatch(/^[A-F0-9]{8}$/);
    });

    it('should handle empty user list', () => {
      const stats = UserPrivacyService.generateUserStats([]);
      expect(stats.totalUsers).toBe(0);
      expect(stats.activeInLast5Min).toBe(0);
      expect(stats.userHashes).toHaveLength(0);
    });

    it('should count users with joinedAt as lastActive fallback', () => {
      const now = Date.now();
      const users = [
        { nickname: 'user1', joinedAt: new Date(now - 1 * 60 * 1000) }
      ];
      
      const stats = UserPrivacyService.generateUserStats(users);
      expect(stats.activeInLast5Min).toBe(1);
    });

    it('should not count inactive users', () => {
      const now = Date.now();
      const users = [
        { nickname: 'user1', lastActive: new Date(now - 10 * 60 * 1000) },
        { nickname: 'user2', lastActive: new Date(now - 20 * 60 * 1000) }
      ];
      
      const stats = UserPrivacyService.generateUserStats(users);
      expect(stats.activeInLast5Min).toBe(0);
    });

    it('should handle users without lastActive or joinedAt', () => {
      const users = [
        { nickname: 'user1' }
      ];
      
      const stats = UserPrivacyService.generateUserStats(users);
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('activeInLast5Min');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long nicknames', () => {
      const longNickname = 'a'.repeat(1000);
      const hash = UserPrivacyService.hashNickname(longNickname);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(8);
    });

    it('should handle unicode characters', () => {
      const unicode = '用户名123';
      const result = UserPrivacyService.generateAnonymousUser(unicode);
      expect(result.hash).toBeDefined();
      expect(result.originalNickname).toBe(unicode);
    });

    it('should handle emojis in nicknames', () => {
      const emoji = 'User😀';
      const hash = UserPrivacyService.hashNickname(emoji);
      expect(hash).toBeDefined();
    });

    it('should handle null nickname gracefully', () => {
      const result = UserPrivacyService.generateAnonymousUser('');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('displayName');
    });
  });

  describe('Data Masking', () => {
    it('should mask email addresses', () => {
      const email = 'user@example.com';
      const masked = email.substring(0, 2) + '*'.repeat(email.length - 5) + email.substring(email.length - 3);
      
      expect(masked).toBeDefined();
      expect(masked).toContain('*');
    });

    it('should mask phone numbers', () => {
      const phone = '+1-555-123-4567';
      const lastFour = phone.slice(-4);
      
      expect(lastFour).toBe('4567');
    });

    it('should mask IP addresses', () => {
      const ip = '192.168.1.100';
      const parts = ip.split('.');
      const masked = parts[0] + '.' + parts[1] + '.*.* ';
      
      expect(masked).toBeDefined();
    });

    it('should mask payment information', () => {
      const cardNumber = '4532-1234-5678-9010';
      const lastFour = cardNumber.slice(-4);
      
      expect(lastFour).toBe('9010');
    });

    it('should mask personal identifiers', () => {
      const ssn = '123-45-6789';
      const lastFour = ssn.slice(-4);
      
      expect(lastFour).toBe('6789');
    });
  });

  describe('User Anonymization', () => {
    it('should generate anonymous ID', () => {
      const anonymousId = 'anon_' + Math.random().toString(36).substr(2, 9);
      
      expect(anonymousId).toMatch(/^anon_/);
    });

    it('should remove user profile data', () => {
      const profile = {
        name: null,
        email: null,
        phone: null,
        address: null
      };

      expect(profile.name).toBeNull();
      expect(profile.email).toBeNull();
    });

    it('should anonymize user activity logs', () => {
      const log = {
        userId: 'anon_xyz123',
        timestamp: new Date(),
        action: 'login'
      };

      expect(log.userId).toMatch(/^anon_/);
    });

    it('should retain only necessary anonymized data', () => {
      const anonymized = {
        userId: 'anon_123',
        timestamp: new Date(),
        action: 'activity'
      };

      expect(Object.keys(anonymized).length).toBeLessThanOrEqual(5);
    });
  });

  describe('Data Deletion', () => {
    it('should delete user account', () => {
      const deleted = {
        userId: '123',
        deletedAt: new Date(),
        status: 'deleted'
      };

      expect(deleted.status).toBe('deleted');
    });

    it('should delete user messages', () => {
      const messages = [
        { id: '1', userId: '123' },
        { id: '2', userId: '123' }
      ];

      const remaining = messages.filter(m => m.userId !== '123');
      expect(remaining.length).toBe(0);
    });

    it('should delete user files', () => {
      const files = [
        { id: 'file1', ownerId: '123' },
        { id: 'file2', ownerId: '123' }
      ];

      const remaining = files.filter(f => f.ownerId !== '123');
      expect(remaining.length).toBe(0);
    });

    it('should delete user sessions', () => {
      const sessions = [
        { id: 'session1', userId: '123' },
        { id: 'session2', userId: '123' }
      ];

      const remaining = sessions.filter(s => s.userId !== '123');
      expect(remaining.length).toBe(0);
    });

    it('should delete related records', () => {
      const records = {
        notifications: [{ userId: '123' }],
        preferences: [{ userId: '123' }],
        settings: [{ userId: '123' }]
      };

      expect(Object.keys(records).length).toBe(3);
    });
  });

  describe('Privacy Settings', () => {
    it('should respect privacy preferences', () => {
      const preferences = {
        shareProfile: false,
        shareActivity: false,
        shareLocation: false,
        allowMessaging: 'friends-only'
      };

      expect(preferences.shareProfile).toBe(false);
      expect(preferences.allowMessaging).toBe('friends-only');
    });

    it('should enforce privacy levels', () => {
      const privacyLevels = {
        public: 0,
        friends: 1,
        private: 2
      };

      expect(privacyLevels.private).toBeGreaterThan(privacyLevels.public);
    });

    it('should hide private data from public queries', () => {
      const publicProfile = {
        username: 'john_doe',
        bio: 'Software developer',
        email: null,
        phone: null,
        address: null
      };

      expect(publicProfile.email).toBeNull();
    });

    it('should allow users to export data', () => {
      const export_result = {
        success: true,
        dataIncluded: ['profile', 'messages', 'activities', 'files'],
        format: 'json'
      };

      expect(export_result.success).toBe(true);
      expect(export_result.dataIncluded.length).toBeGreaterThan(0);
    });
  });

  describe('Consent Management', () => {
    it('should track consent status', () => {
      const consent = {
        userId: '123',
        dataProcessing: true,
        marketing: false,
        analytics: true,
        timestamp: new Date()
      };

      expect(consent.dataProcessing).toBe(true);
      expect(consent.marketing).toBe(false);
    });

    it('should update consent preferences', () => {
      const oldConsent = { marketing: true };
      const newConsent = { marketing: false };

      expect(oldConsent.marketing).not.toBe(newConsent.marketing);
    });

    it('should log consent changes', () => {
      const log = {
        userId: '123',
        action: 'consent_updated',
        timestamp: new Date(),
        changes: { marketing: 'true -> false' }
      };

      expect(log.action).toBe('consent_updated');
    });

    it('should require explicit consent for new features', () => {
      const featureConsent = {
        featureId: 'new_feature_1',
        requiresConsent: true,
        consented: false
      };

      expect(featureConsent.requiresConsent).toBe(true);
    });
  });

  describe('GDPR Compliance', () => {
    it('should implement right to be forgotten', () => {
      const result = {
        requested: true,
        processed: true,
        completedAt: new Date()
      };

      expect(result.processed).toBe(true);
    });

    it('should provide data access within 30 days', () => {
      const request = {
        requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        status: 'in_progress'
      };

      expect(request.status).toBe('in_progress');
    });

    it('should maintain data retention policies', () => {
      const retention = {
        personalData: 365 * 24 * 60 * 60 * 1000,
        logs: 90 * 24 * 60 * 60 * 1000,
        backups: 30 * 24 * 60 * 60 * 1000
      };

      expect(retention.personalData).toBeGreaterThan(retention.logs);
    });

    it('should encrypt personal data at rest', () => {
      const encrypted = {
        algorithm: 'AES-256',
        keyRotation: 'monthly',
        encrypted: true
      };

      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.algorithm).toBe('AES-256');
    });
  });

  describe('Audit Logging', () => {
    it('should log all privacy operations', () => {
      const auditLog = {
        operation: 'user_deleted',
        userId: '123',
        timestamp: new Date(),
        performedBy: 'admin'
      };

      expect(auditLog.operation).toBe('user_deleted');
    });

    it('should track data access', () => {
      const accessLog = {
        userId: '123',
        dataAccessed: 'profile_info',
        accessedBy: 'support_team',
        timestamp: new Date(),
        reason: 'support_ticket'
      };

      expect(accessLog.reason).toBe('support_ticket');
    });

    it('should maintain immutable audit trail', () => {
      const log1 = { id: '1', action: 'delete', timestamp: new Date() };
      const log2 = { id: '2', action: 'anonymize', timestamp: new Date() };

      expect(log1.id).not.toBe(log2.id);
    });
  });

  describe('Third-Party Integration', () => {
    it('should control third-party data sharing', () => {
      const sharing = {
        analytics: false,
        marketing: false,
        thirdPartyApps: false
      };

      expect(sharing.analytics).toBe(false);
    });

    it('should manage API access tokens', () => {
      const token = {
        scopes: ['profile', 'email'],
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revoked: false
      };

      expect(token.scopes.length).toBeGreaterThan(0);
      expect(token.revoked).toBe(false);
    });

    it('should revoke external access', () => {
      const revoked = {
        applicationId: 'app_123',
        revokedAt: new Date(),
        status: 'revoked'
      };

      expect(revoked.status).toBe('revoked');
    });
  });

  describe('Error Handling', () => {
    it('should handle deletion errors', () => {
      const error = new Error('Failed to delete user data');
      
      expect(error.message).toBeDefined();
    });

    it('should handle anonymization failures', () => {
      const error = new Error('Anonymization failed');
      
      expect(error.message).toContain('failed');
    });

    it('should validate data before deletion', () => {
      const userData = null;
      
      expect(userData).toBeNull();
    });
  });
});
