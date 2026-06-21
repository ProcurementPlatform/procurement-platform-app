import Joi from 'joi';

export const feedbackSchema = Joi.object({
  feature: Joi.string().valid('chat', 'contract', 'search', 'invoice').required(),
  referenceId: Joi.string().allow('', null),
  rating: Joi.string().valid('up', 'down').required(),
  comment: Joi.string().allow('', null).max(2000),
  context: Joi.object().unknown(true),
});

// Chat and search schemas land with their respective feature phases.
export const chatSchema = Joi.object({
  messages: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().required().max(8000),
      })
    )
    .min(1)
    .required(),
  structured: Joi.boolean().default(false),
});

export const searchSchema = Joi.object({
  query: Joi.string().required().max(2000),
  category: Joi.string().valid('contract', 'invoice', 'purchase_order', 'vendor_certificate').allow('', null),
  topK: Joi.number().integer().min(1).max(20).default(5),
});
