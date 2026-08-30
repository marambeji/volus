import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('skips sending and returns false when SMTP env vars are missing', async () => {
    delete process.env.MAIL_HOST;
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASS;

    const service = new MailService();
    const result = await service.sendMail('to@example.com', 'Subject', '<p>Body</p>');

    expect(result).toBe(false);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('sends via the configured transporter when SMTP env vars are present', async () => {
    process.env.MAIL_HOST = 'smtp.gmail.com';
    process.env.MAIL_PORT = '587';
    process.env.MAIL_USER = 'user@example.com';
    process.env.MAIL_PASS = 'secret';
    process.env.MAIL_FROM = 'volus <user@example.com>';

    const sendMailMock = jest.fn().mockResolvedValue({ messageId: '1' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });

    const service = new MailService();
    const result = await service.sendMail('to@example.com', 'Subject', '<p>Body</p>');

    expect(result).toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'volus <user@example.com>',
      to: 'to@example.com',
      subject: 'Subject',
      html: '<p>Body</p>',
    });
  });

  it('returns false without throwing when the transporter rejects', async () => {
    process.env.MAIL_HOST = 'smtp.gmail.com';
    process.env.MAIL_USER = 'user@example.com';
    process.env.MAIL_PASS = 'secret';

    const sendMailMock = jest.fn().mockRejectedValue(new Error('SMTP down'));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });

    const service = new MailService();

    await expect(service.sendMail('to@example.com', 'Subject', '<p>Body</p>')).resolves.toBe(false);
  });
});
