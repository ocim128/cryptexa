# Contributing to Cryptexa

Thank you for your interest in contributing to Cryptexa! We welcome contributions from the community and are pleased to have you join us.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)
- [Security Guidelines](#security-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Git
- A code editor (VS Code recommended)

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/cryptexa.git
   cd cryptexa
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/originalowner/cryptexa.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Start the development server**:
   ```bash
   npm run dev
   ```

## 🔧 Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-export-functionality`
- `fix/memory-leak-in-encryption`
- `docs/update-deployment-guide`
- `security/improve-rate-limiting`

### Commit Messages

Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `security`: Security improvements
- `perf`: Performance improvements

Examples:
```
feat(encryption): add support for additional cipher modes
fix(api): resolve race condition in save endpoint
docs(readme): update installation instructions
security(auth): implement additional rate limiting
```

## 📤 Submitting Changes

### Pull Request Process

1. **Update your fork**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** and commit them

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request** on GitHub

### Pull Request Guidelines

- **Clear title and description**: Explain what changes you made and why
- **Reference issues**: Link to any related issues
- **Small, focused changes**: Keep PRs manageable and focused
- **Update documentation**: Include relevant documentation updates
- **Add tests**: Include tests for new functionality
- **Security considerations**: Highlight any security implications

## 🎨 Style Guidelines

### JavaScript

- Use ES6+ features where appropriate
- Follow existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic
- Prefer `const` over `let`, avoid `var`

### CSS

- Use CSS custom properties (variables) for theming
- Follow BEM methodology for class naming
- Ensure responsive design principles
- Test in multiple browsers

### HTML

- Use semantic HTML elements
- Ensure accessibility (ARIA labels, proper headings)
- Validate markup

## 🔒 Security Guidelines

### Critical Security Areas

1. **Client-side Encryption**: Never modify encryption without thorough review
2. **API Endpoints**: Validate all inputs and outputs
3. **Dependencies**: Keep dependencies updated and secure
4. **Environment Variables**: Never commit secrets or keys

### Security Review Process

- All security-related changes require additional review
- Test security features thoroughly
- Document security implications
- Consider attack vectors and edge cases

## 🧪 Testing

### Manual Testing

- Test in multiple browsers (Chrome, Firefox, Safari, Edge)
- Test on different devices and screen sizes
- Verify encryption/decryption functionality
- Test error handling and edge cases

### Automated Testing

- Add unit tests for new functions
- Include integration tests for API endpoints
- Test security features thoroughly
- Ensure tests pass before submitting PR

### Testing Checklist

- [ ] Functionality works as expected
- [ ] No console errors or warnings
- [ ] Responsive design maintained
- [ ] Accessibility standards met
- [ ] Security features intact
- [ ] Performance not degraded

## 📚 Documentation

### What to Document

- New features and functionality
- API changes or additions
- Configuration options
- Security considerations
- Breaking changes

### Documentation Standards

- Use clear, concise language
- Include code examples
- Update relevant files (README, DEPLOYMENT, SECURITY)
- Use proper markdown formatting

## 🐛 Reporting Issues

### Bug Reports

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information
- Screenshots if applicable

### Feature Requests

Include:
- Clear description of the feature
- Use case and benefits
- Potential implementation approach
- Security and performance considerations

### Security Issues

**Do not open public issues for security vulnerabilities.**

Instead:
- Email security concerns privately
- Provide detailed information
- Allow time for fixes before disclosure

## 🏷️ Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements or additions to documentation
- `security`: Security-related issues
- `performance`: Performance improvements
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed

## 🎯 Areas for Contribution

### High Priority

- Security auditing and improvements
- Performance optimizations
- Browser compatibility testing
- Documentation improvements
- Accessibility enhancements

### Medium Priority

- UI/UX improvements
- Additional export/import formats
- Mobile app development
- Internationalization (i18n)

### Low Priority

- Additional themes
- Plugin system
- Advanced editor features
- Integration with external services

## 📞 Getting Help

- **Documentation**: Check existing docs first
- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Open an issue for bugs or feature requests
- **Community**: Join our community channels

## 🙏 Recognition

Contributors will be:
- Listed in the project's contributors section
- Mentioned in release notes for significant contributions
- Invited to join the core team for ongoing contributors

Thank you for contributing to Cryptexa! Your efforts help make secure note-taking accessible to everyone. 🔐✨