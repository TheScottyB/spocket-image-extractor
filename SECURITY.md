# Security Guidelines for Spocket Image Extractor

## PNPM Security Best Practices

### Package Management
- Always verify package integrity using `pnpm audit`
- Keep dependencies up to date: `pnpm update`
- Use exact versions in package.json for production
- Review package.json changes in pull requests

### Dependency Management
- Minimize external dependencies
- Prefer well-maintained, popular packages
- Use `pnpm audit --fix` to automatically fix vulnerabilities
- Check package licenses for compliance

## Chrome Extension Security

### Permissions
- **Principle of Least Privilege**: Only request necessary permissions
- Current permissions justified:
  - `activeTab`: Required to access current Spocket product page
  - `downloads`: Required to save images and metadata files
  - `scripting`: Required to inject content script for DOM parsing
  - `storage`: Required for extension configuration and state

### Host Permissions
- Restricted to specific domains:
  - `https://app.spocket.co/*`: Target application domain
  - `https://d2nxps5jx3f309.cloudfront.net/*`: Image CDN domain

### Content Security
- All user inputs are sanitized before file system operations
- Filenames are cleaned to prevent directory traversal
- URLs are validated against allowed domains
- No eval() or similar dangerous functions used

### Data Handling
- No sensitive user data is stored permanently
- Downloaded files are saved to user's designated download folder
- Metadata is exported as JSON for transparency
- No data is transmitted to external servers

### Secure Development Practices
- Regular security audits of dependencies
- Input validation and sanitization
- Error handling without information disclosure
- Minimal data retention policy

## Development Environment Security

### Version Control
- Use signed commits with GPG when possible
- Keep sensitive information out of repository
- Use environment variables for any configuration

### Build Process
- Use Volta for consistent Node.js version management
- Regular dependency updates and security patches
- Automated testing in CI/CD pipeline

## Incident Response
If a security vulnerability is discovered:
1. Document the issue privately
2. Assess impact and create patch
3. Test fix thoroughly
4. Release security update
5. Notify users if necessary

## Reporting Security Issues
Report security vulnerabilities through GitHub Security Advisories or email the maintainer directly.
