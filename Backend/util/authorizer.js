import crypto from 'crypto';

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';

export function encryptPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
    return `${salt}:${derived}`;
}

export function validatePassword(password, stored) {
    if (!stored) return false;
    const [salt, key] = stored.split(':');
    if (!salt || !key) return false;
    const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
    const derivedBuffer = Buffer.from(derived, 'hex');
    const storedBuffer = Buffer.from(key, 'hex');
    if (derivedBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(derivedBuffer, storedBuffer);
}

const authorizer = { encryptPassword, validatePassword };
export default authorizer;