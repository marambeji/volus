import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('database.url');
        const host = configService.get<string>('database.host');
        const port = configService.get<number>('database.port');
        const username = configService.get<string>('database.username');
        const password = configService.get<string>('database.password');
        const database = configService.get<string>('database.database');
        const ssl = configService.get<boolean>('database.ssl');
        const rejectUnauthorized = configService.get<boolean>(
          'database.rejectUnauthorized',
        );

        const sslConfig = ssl ? { ssl: { rejectUnauthorized } } : {};

        const baseConfig = url
          ? { url }
          : {
              host,
              port,
              username,
              password,
              database,
            };

        return {
          type: 'postgres',
          ...baseConfig,
          // SSL must be provided even when using a connection URL, because
          // the pg driver does NOT inherit it from the URL string itself.
          ...(ssl ? { ssl: { rejectUnauthorized } } : {}),
          // extra.ssl is the pg-level option — needed for Supabase pooler (port 6543)
          extra: ssl ? { ssl: { rejectUnauthorized } } : {},
          autoLoadEntities: true,
          synchronize: false,
          logging: configService.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
