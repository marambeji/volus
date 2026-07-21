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
          ...sslConfig, // always applied; empty object when DB_SSL=false
          autoLoadEntities: true,
          synchronize: false,
          logging: configService.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
