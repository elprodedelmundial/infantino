# PRODE Homepage - Makefile
# Angular project management commands

.PHONY: help install start serve build build-prod clean test lint format

# Default target
help:
	@echo "PRODE Homepage - Available targets:"
	@echo ""
	@echo "  install     Install npm dependencies"
	@echo "  start       Start development server (alias for serve)"
	@echo "  serve       Start development server on http://localhost:4200"
	@echo "  serve-open  Start development server and open browser"
	@echo "  build       Build the application for development"
	@echo "  build-prod  Build the application for production"
	@echo "  clean       Remove build artifacts and node_modules"
	@echo "  test        Run unit tests"
	@echo "  lint        Run linter"
	@echo "  deploy      Deploy static content to Firebase Hosting"
	@echo "  format      Format code with Prettier (if available)"
	@echo ""

# Install dependencies
install:
	npm install

# Start development server
start: serve

serve:
	npm run start

serve-open:
	npm run start -- --open

# Build targets
build:
	npm run build -- --configuration development

build-prod:
	npm run build -- --configuration production


deploy: install build-prod
	firebase deploy --only hosting

# Clean build artifacts
clean:
	rm -rf node_modules
	rm -rf dist
	rm -rf .angular/cache
	rm -rf out-tsc

# Testing
test:
	npm run test

# Linting
lint:
	npm run lint

# Watch mode for development
watch:
	npm run watch

# Generate logos from codebase
generate-logos:
	@cd resources
	@python3 -m venv venv
	@source venv/bin/activate
	@pip install pillow cairosvg -q
	@python3 generate_logos.py && echo "✓ All logo files generated successfully in the resources directory!"
	@rm -rf venv

# Generate component (usage: make component NAME=my-component)
component:
	@if [ -z "$(NAME)" ]; then \
		echo "Usage: make component NAME=component-name"; \
	else \
		npx ng generate component components/$(NAME) --standalone; \
	fi

# Generate service (usage: make service NAME=my-service)
service:
	@if [ -z "$(NAME)" ]; then \
		echo "Usage: make service NAME=service-name"; \
	else \
		npx ng generate service services/$(NAME); \
	fi

# Generate page (usage: make page NAME=my-page)
page:
	@if [ -z "$(NAME)" ]; then \
		echo "Usage: make page NAME=page-name"; \
	else \
		npx ng generate component pages/$(NAME) --standalone; \
	fi
