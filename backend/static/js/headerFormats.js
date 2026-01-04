/**
 * Header Format Configuration
 *
 * Define default formatting rules for document headers.
 * Each format can specify:
 *   - fontSize: Font size as string (e.g., '16pt', '14px')
 *   - bold: Boolean to wrap content in <b> tag
 *   - italic: Boolean to wrap content in <i> tag
 *   - underline: Boolean to wrap content in <u> tag
 *
 * To customize: Edit the values below and refresh the page.
 */

const HeaderFormats = {
    h1: {
        fontSize: '16pt',
        bold: true,
        italic: false,
        underline: false
    },
    h2: {
        fontSize: '13pt',
        bold: true,
        italic: false,
        underline: false
    },
    h3: {
        fontSize: '12pt',
        bold: true,
        italic: false,
        underline: false
    },
    p: {
        // Paragraph has no default formatting
        // Font size and styling determined by user selection
    }
};
