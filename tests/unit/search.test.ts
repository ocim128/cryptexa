import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('search previews', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = `
            <div class="tab-header" data-tab-id="tab-0"><span class="tab-title">Note</span></div>
            <div id="tab-0"><textarea class="textarea-contents"></textarea></div>
        `;
    });

    it.each(['hello', 'first line\nhello', 'first line\nhello\n'])('preserves a match at the end of a logical line in %j', async (content) => {
        document.querySelector<HTMLTextAreaElement>('textarea')!.value = content;
        const { searchAllTabs } = await import('../../src/ui/search');
        const result = searchAllTabs('lo')[0]!;
        expect(result.lineContent).toBe('hello');
        expect(result.lineContent.slice(result.matchStart, result.matchEnd)).toBe('lo');
    });
});
