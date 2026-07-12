import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthService', () => {
  const pepper = 'test-pepper';
  let prisma: any;
  let config: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    config = {
      get: jest.fn((key: string) => (key === 'PIN_PEPPER' ? pepper : undefined)),
    };
    service = new AuthService(prisma as any, config as any);
  });

  it('setPin hashes and stores the PIN', async () => {
    prisma.user.update.mockResolvedValue({});
    await service.setPin('+250780000001', '1234');
    expect(prisma.user.update).toHaveBeenCalled();
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.pinHash).toBeTruthy();
    expect(data.pinHash).not.toBe('1234');
    expect(data.pinAttempts).toBe(0);
  });

  it('verifyPin succeeds with correct PIN and resets attempts', async () => {
    prisma.user.update.mockResolvedValue({});
    await service.setPin('+250780000001', '1234');
    const pinHash = prisma.user.update.mock.calls[0][0].data.pinHash;

    prisma.user.findUnique.mockResolvedValue({
      phoneNumber: '+250780000001',
      pinHash,
      pinAttempts: 2,
      lockoutUntil: null,
    });

    await expect(service.verifyPin('+250780000001', '1234')).resolves.toBe(true);
    expect(prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pinAttempts: 0, lockoutUntil: null }),
      }),
    );
  });

  it('locks after 5 failed attempts', async () => {
    prisma.user.update.mockResolvedValue({});
    await service.setPin('+250780000001', '1234');
    const pinHash = prisma.user.update.mock.calls[0][0].data.pinHash;

    prisma.user.findUnique.mockResolvedValue({
      phoneNumber: '+250780000001',
      pinHash,
      pinAttempts: 4,
      lockoutUntil: null,
    });

    await expect(service.verifyPin('+250780000001', '9999')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const update = prisma.user.update.mock.calls.at(-1)[0].data;
    expect(update.pinAttempts).toBe(5);
    expect(update.lockoutUntil).toBeInstanceOf(Date);
  });

  it('rejects while locked out without checking PIN', async () => {
    prisma.user.findUnique.mockResolvedValue({
      phoneNumber: '+250780000001',
      pinHash: 'x',
      pinAttempts: 5,
      lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
    });

    await expect(service.verifyPin('+250780000001', '1234')).rejects.toThrow(/locked/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
