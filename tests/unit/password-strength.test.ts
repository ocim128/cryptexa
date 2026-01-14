/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { analyzePasswordStrength, StrengthLevel } from '../../src/ui/password-strength';

describe('Password Strength Analyzer', () => {
    describe('analyzePasswordStrength', () => {
        it('should return weak for empty password', () => {
            const result = analyzePasswordStrength('');
            expect(result.level).toBe('weak');
            expect(result.score).toBe(0);
        });

        it('should return weak for very short passwords', () => {
            const result = analyzePasswordStrength('abc');
            expect(result.level).toBe('weak');
            expect(result.score).toBeLessThan(30);
        });

        it('should return weak for passwords with only lowercase', () => {
            const result = analyzePasswordStrength('password');
            expect(result.level).toBe('weak');
        });

        it('should penalize common patterns like "password"', () => {
            const common = analyzePasswordStrength('password123');
            const random = analyzePasswordStrength('xyzpdq123');
            expect(common.score).toBeLessThanOrEqual(random.score);
        });

        it('should give higher score for mixed case', () => {
            const lower = analyzePasswordStrength('abcdefgh');
            const mixed = analyzePasswordStrength('AbCdEfGh');
            expect(mixed.score).toBeGreaterThan(lower.score);
        });

        it('should give higher score for adding numbers', () => {
            const noNumbers = analyzePasswordStrength('AbCdEfGh');
            const withNumbers = analyzePasswordStrength('AbCdEf12');
            expect(withNumbers.score).toBeGreaterThan(noNumbers.score);
        });

        it('should give higher score for special characters', () => {
            const noSpecial = analyzePasswordStrength('AbCdEf12');
            const withSpecial = analyzePasswordStrength('AbCdEf1!');
            expect(withSpecial.score).toBeGreaterThan(noSpecial.score);
        });

        it('should return strong for complex passwords', () => {
            const result = analyzePasswordStrength('MyStr0ng!Pass');
            expect(['good', 'strong', 'very-strong']).toContain(result.level);
        });

        it('should return very-strong for long complex passwords', () => {
            const result = analyzePasswordStrength('MyV3ry$ecur3P@ssw0rd!2024');
            expect(['strong', 'very-strong']).toContain(result.level);
            expect(result.score).toBeGreaterThanOrEqual(70);
        });

        it('should give bonus for passphrase-style passwords', () => {
            const result = analyzePasswordStrength('correct horse battery staple!');
            expect(result.score).toBeGreaterThanOrEqual(50);
        });

        it('should penalize repeated characters', () => {
            const repeated = analyzePasswordStrength('aaaaaaa');
            expect(repeated.level).toBe('weak');
        });

        it('should penalize all-numbers passwords', () => {
            const result = analyzePasswordStrength('12345678');
            expect(result.level).toBe('weak');
        });

        it('should provide feedback for weak passwords', () => {
            const result = analyzePasswordStrength('abc');
            expect(result.feedback.length).toBeGreaterThan(0);
        });

        it('should suggest adding uppercase for lowercase-only', () => {
            const result = analyzePasswordStrength('abcdefghij');
            expect(result.feedback.some(f => f.toLowerCase().includes('uppercase'))).toBe(true);
        });

        it('should suggest adding numbers when missing', () => {
            const result = analyzePasswordStrength('AbcDefGhi');
            expect(result.feedback.some(f => f.toLowerCase().includes('number'))).toBe(true);
        });

        it('should suggest adding special characters when missing', () => {
            const result = analyzePasswordStrength('AbcDef123');
            expect(result.feedback.some(f => f.toLowerCase().includes('special'))).toBe(true);
        });

        it('should return correct colors for each level', () => {
            const weak = analyzePasswordStrength('a');
            expect(weak.color).toContain('danger');

            const strong = analyzePasswordStrength('MyStr0ng!P@ssw0rd2024');
            expect(['#22c55e', 'var(--accent)']).toContain(strong.color);
        });

        it('should return appropriate labels', () => {
            const weak = analyzePasswordStrength('ab');
            expect(weak.label).toBe('Weak');

            const veryStrong = analyzePasswordStrength('correct horse battery staple 2024!');
            expect(veryStrong.label).toBe('Very Strong');
        });

        it('should handle unicode characters', () => {
            const result = analyzePasswordStrength('Pässwörd123!');
            expect(result.score).toBeGreaterThan(0);
        });

        it('should cap score at 100', () => {
            const result = analyzePasswordStrength('This is an extremely long and complex password with all kinds of $pecial ch@racters 1234567890!');
            expect(result.score).toBeLessThanOrEqual(100);
        });

        it('should not give negative score', () => {
            const result = analyzePasswordStrength('password');
            expect(result.score).toBeGreaterThanOrEqual(0);
        });
    });

    describe('strength levels', () => {
        const testCases: [string, StrengthLevel[]][] = [
            ['', ['weak']],
            ['a', ['weak']],
            ['ab', ['weak']],
            ['abc', ['weak']],
            ['abcdef', ['weak']],
            ['Abcdef', ['weak', 'fair']],
            ['Abcdef1', ['weak', 'fair']],
            ['Abcdef1!', ['fair', 'good', 'strong']],
            ['MyPassword1!', ['good', 'strong']],
            ['MyV3ryStr0ng!Pass', ['strong', 'very-strong']],
        ];

        it.each(testCases)('should classify "%s" as one of %s', (password, expectedLevels) => {
            const result = analyzePasswordStrength(password);
            expect(expectedLevels).toContain(result.level);
        });
    });
});
