# Yannick Matia — portfolio redesign

Plain HTML and CSS. No Jekyll theme, JavaScript dependency, subscription, or build step.

## Update your existing GitHub site
1. Unzip this package.
2. In your local portfolio repository, replace index.html and style.css with these versions. Copy favicon.svg, .nojekyll, and the assets folder into the repository root too. Preserve your .git folder and any unrelated files.
3. Open index.html in your browser to preview. In VS Code, edit index.html for content and style.css for design.
4. Review the changes in VS Code Source Control, stage the changed website files, commit, then push/sync to your existing main branch.
5. Your existing GitHub Pages configuration can remain main / root. Do not upload the ZIP or a containing folder. The entry file must be at the repository root.

Alternatively, upload the extracted files and assets folder through GitHub's Add file > Upload files, then commit. Confirm that assets/yannick-matia.jpg exists after upload.

Your site address remains https://yannickmatia.github.io/portfolio/ . This package has not been pushed to your GitHub account for you.

## Editing
- Identity and social links: near the top of index.html.
- Work: six project articles in the Professional work disclosure.
- Assessment: the aside with class assessment, below the CRM project bullets. This is labeled as a hypothetical interview exercise and does not claim achieved results.
- About: search EDIT BIO. The current short bio is based on your supplied resume and interests.
- Colors, spacing, responsive layout: style.css.
- Portrait: assets/yannick-matia.jpg, copied unchanged from your supplied photo; CSS controls its display crop.
- All three sections use native details/summary elements, supporting keyboard interaction without JavaScript. Professional work opens by default; remove its open attribute to start collapsed.

No original assessment PDF, project tracker, or internal document links are shipped. Fonts use local system fonts, so the site does not depend on an external font service.
