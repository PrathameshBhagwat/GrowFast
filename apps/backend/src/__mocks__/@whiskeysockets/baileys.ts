const mockSocket = {
  ev: {
    on: jest.fn(),
  },
  onWhatsApp: jest.fn().mockResolvedValue([{ exists: true }]),
  sendMessage: jest.fn().mockResolvedValue({ key: { id: 'mock-id' } }),
};

export const DisconnectReason = {
  loggedOut: 401,
};

export const fetchLatestBaileysVersion = jest
  .fn()
  .mockResolvedValue({ version: [2, 3000, 1], isLatest: true });
export const useMultiFileAuthState = jest
  .fn()
  .mockResolvedValue({ state: {}, saveCreds: jest.fn() });

export default jest.fn().mockReturnValue(mockSocket);
