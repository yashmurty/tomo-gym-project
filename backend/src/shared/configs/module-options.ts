import { ConfigModuleOptions } from '@nestjs/config/dist/interfaces';
import * as Joi from 'joi';

import configuration from './configuration';

export const configModuleOptions: ConfigModuleOptions = {
  envFilePath: '.env',
  load: [configuration],
  validationSchema: Joi.object({
    APP_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .default('development'),
    APP_PORT: Joi.number().required(),
    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().optional(),
    DB_NAME: Joi.string().required(),
    DB_USER: Joi.string().required(),
    DB_PASS: Joi.string().required(),
    JWT_PUBLIC_KEY_BASE64: Joi.string().required(),
    JWT_PRIVATE_KEY_BASE64: Joi.string().required(),
    JWT_ACCESS_TOKEN_EXP_IN_SEC: Joi.number().required(),
    JWT_REFRESH_TOKEN_EXP_IN_SEC: Joi.number().required(),
    DEFAULT_ADMIN_USER_PASSWORD: Joi.string().required(),
    // Signup gate (all optional; defaults in configuration.ts).
    SIGNUP_MODE: Joi.string().valid('open', 'closed').optional(),
    CHAT_RATE_PER_MINUTE: Joi.number().integer().min(1).optional(),
    CHAT_RATE_PER_DAY: Joi.number().integer().min(1).optional(),
    MCP_RATE_PER_MINUTE: Joi.number().integer().min(1).optional(),
    MCP_RATE_PER_DAY: Joi.number().integer().min(1).optional(),
    LOGIN_RATE_PER_MINUTE: Joi.number().integer().min(1).optional(),
    SIGNUP_RATE_PER_HOUR: Joi.number().integer().min(1).optional(),
    USER_DAILY_BUDGET_USD: Joi.number().min(0).optional(),
    USER_MONTHLY_BUDGET_USD: Joi.number().min(0).optional(),
    GLOBAL_DAILY_BUDGET_USD: Joi.number().min(0).optional(),
  }),
};
