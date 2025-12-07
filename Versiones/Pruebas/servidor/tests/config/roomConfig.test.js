const {
  ROOM_LIMITS,
  ROOM_TYPES,
  ROOM_TYPE_CONFIG,
  getMultimediaConfig,
  validateRoomConfig,
  isFileTypeAllowed,
  getMaxFileSize
} = require('../../config/roomConfig');

describe('roomConfig', () => {
  describe('Constants', () => {
    it('should export ROOM_LIMITS', () => {
      expect(ROOM_LIMITS).toBeDefined();
      expect(ROOM_LIMITS.MAX_PARTICIPANTS).toBe(50);
      expect(ROOM_LIMITS.MIN_PARTICIPANTS).toBe(2);
    });

    it('should export ROOM_TYPES', () => {
      expect(ROOM_TYPES).toBeDefined();
      expect(ROOM_TYPES.TEXT).toBe('text');
      expect(ROOM_TYPES.MULTIMEDIA).toBe('multimedia');
    });

    it('should export ROOM_TYPE_CONFIG', () => {
      expect(ROOM_TYPE_CONFIG).toBeDefined();
      expect(ROOM_TYPE_CONFIG.text).toBeDefined();
      expect(ROOM_TYPE_CONFIG.multimedia).toBeDefined();
    });
  });

  describe('getMultimediaConfig', () => {
    it('should return config for text room', () => {
      const config = getMultimediaConfig('text');
      expect(config.maxFileSize).toBe(0);
      expect(config.allowedFileTypes).toEqual([]);
      expect(config.steganographyCheck).toBe(false);
    });

    it('should return config for multimedia room', () => {
      const config = getMultimediaConfig('multimedia');
      expect(config.maxFileSize).toBeGreaterThan(0);
      expect(config.allowedFileTypes.length).toBeGreaterThan(0);
      expect(config.steganographyCheck).toBe(true);
    });

    it('should return default config for invalid type', () => {
      const config = getMultimediaConfig('invalid');
      expect(config.maxFileSize).toBe(0);
    });

    it('should return default config for null', () => {
      const config = getMultimediaConfig(null);
      expect(config).toBeDefined();
    });
  });

  describe('validateRoomConfig', () => {
    it('should validate correct config', () => {
      const config = {
        name: 'Test Room',
        roomType: 'text',
        maxParticipants: 10
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing name', () => {
      const config = {
        roomType: 'text',
        maxParticipants: 10
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject short name', () => {
      const config = {
        name: 'AB',
        roomType: 'text',
        maxParticipants: 10
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject long name', () => {
      const config = {
        name: 'A'.repeat(50),
        roomType: 'text',
        maxParticipants: 10
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid room type', () => {
      const config = {
        name: 'Test',
        roomType: 'invalid',
        maxParticipants: 10
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject too few participants', () => {
      const config = {
        name: 'Test',
        roomType: 'text',
        maxParticipants: 1
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should reject too many participants', () => {
      const config = {
        name: 'Test',
        roomType: 'text',
        maxParticipants: 100
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should validate multimedia room', () => {
      const config = {
        name: 'Multimedia Room',
        roomType: 'multimedia',
        maxParticipants: 20
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(true);
    });

    it('should handle non-string name', () => {
      const config = {
        name: 123,
        roomType: 'text',
        maxParticipants: 10
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(false);
    });

    it('should handle non-number maxParticipants', () => {
      const config = {
        name: 'Test',
        roomType: 'text',
        maxParticipants: '10'
      };
      const result = validateRoomConfig(config);
      expect(result.isValid).toBe(false);
    });
  });

  describe('isFileTypeAllowed', () => {
    it('should reject all files in text rooms', () => {
      expect(isFileTypeAllowed('image/jpeg', 'text')).toBe(false);
      expect(isFileTypeAllowed('application/pdf', 'text')).toBe(false);
    });

    it('should allow images in multimedia rooms', () => {
      expect(isFileTypeAllowed('image/jpeg', 'multimedia')).toBe(true);
      expect(isFileTypeAllowed('image/png', 'multimedia')).toBe(true);
    });

    it('should allow documents in multimedia rooms', () => {
      expect(isFileTypeAllowed('application/pdf', 'multimedia')).toBe(true);
    });

    it('should allow videos in multimedia rooms', () => {
      expect(isFileTypeAllowed('video/mp4', 'multimedia')).toBe(true);
    });

    it('should reject unlisted types in multimedia rooms', () => {
      expect(isFileTypeAllowed('application/x-msdownload', 'multimedia')).toBe(false);
    });

    it('should handle invalid room type', () => {
      expect(isFileTypeAllowed('image/jpeg', 'invalid')).toBe(false);
    });

    it('should handle null room type', () => {
      expect(isFileTypeAllowed('image/jpeg', null)).toBe(false);
    });
  });

  describe('getMaxFileSize', () => {
    it('should return 0 for text rooms', () => {
      expect(getMaxFileSize('text')).toBe(0);
    });

    it('should return size for multimedia rooms', () => {
      const size = getMaxFileSize('multimedia');
      expect(size).toBeGreaterThan(0);
      expect(size).toBe(15728640); // 15MB
    });

    it('should return 0 for invalid room type', () => {
      expect(getMaxFileSize('invalid')).toBe(0);
    });

    it('should return 0 for null', () => {
      expect(getMaxFileSize(null)).toBe(0);
    });
  });

  describe('ROOM_TYPE_CONFIG structure', () => {
    it('should have text config with features', () => {
      expect(ROOM_TYPE_CONFIG.text.features).toBeDefined();
      expect(ROOM_TYPE_CONFIG.text.features.length).toBeGreaterThan(0);
    });

    it('should have multimedia config with features', () => {
      expect(ROOM_TYPE_CONFIG.multimedia.features).toBeDefined();
      expect(ROOM_TYPE_CONFIG.multimedia.features.length).toBeGreaterThan(0);
    });

    it('should have descriptive names', () => {
      expect(ROOM_TYPE_CONFIG.text.name).toBeDefined();
      expect(ROOM_TYPE_CONFIG.multimedia.name).toBeDefined();
    });

    it('should have descriptions', () => {
      expect(ROOM_TYPE_CONFIG.text.description).toBeDefined();
      expect(ROOM_TYPE_CONFIG.multimedia.description).toBeDefined();
    });
  });
});
