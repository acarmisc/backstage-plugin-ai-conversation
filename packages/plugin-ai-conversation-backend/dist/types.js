"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAT_PERSONA_ANNOTATION_PREFIX = exports.CHAT_PERSONA_TYPE = exports.CHAT_SKILL_ANNOTATION_PREFIX = exports.CHAT_SKILL_TYPE = void 0;
/** Value of `spec.type` that marks a catalog Component as a chat skill. */
exports.CHAT_SKILL_TYPE = 'chat-skill';
/** Annotation namespace for skill-specific fields on a catalog entity. */
exports.CHAT_SKILL_ANNOTATION_PREFIX = 'chat-skill.acarmisc.org';
/** Backwards compatibility: old persona type/annotation names. */
exports.CHAT_PERSONA_TYPE = exports.CHAT_SKILL_TYPE;
exports.CHAT_PERSONA_ANNOTATION_PREFIX = exports.CHAT_SKILL_ANNOTATION_PREFIX;
