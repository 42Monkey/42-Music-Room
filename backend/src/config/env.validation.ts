import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
});
