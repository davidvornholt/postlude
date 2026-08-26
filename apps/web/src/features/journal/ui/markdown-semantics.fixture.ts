export const markdownSemanticsFixture = `# Entry heading

## Entry subheading

[Secure uppercase](HTTPS://Example.com/Upper)

[Web mixed case](hTtP://example.com/Mixed)`;

export const markdownSemanticsLinks = [
  { href: 'HTTPS://Example.com/Upper', name: 'Secure uppercase' },
  { href: 'hTtP://example.com/Mixed', name: 'Web mixed case' },
] as const;
