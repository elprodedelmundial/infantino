# PRODE Homepage - Makefile
# Angular project management commands

.PHONY: help install start serve serve-open build build-prod clean test lint format deploy confirm-local config-prod config-local

# Grondona API targets used when switching src/config.js
PROD_GRONDONA_URL := https://grondona-897932846991.southamerica-east1.run.app
LOCAL_GRONDONA_URL := http://localhost:8080

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
	@echo "  deploy      Point config to prod, deploy to Firebase, then revert to local"
	@echo "  config-prod   Point 'grondona-url' in src/config.js to production"
	@echo "  config-local  Point 'grondona-url' in src/config.js to localhost"
	@echo "  format      Format code with Prettier (if available)"
	@echo ""

# Install dependencies
install:
	npm install

# Start development server
start: serve

serve: confirm-local
	npm run start

serve-open: confirm-local
	npm run start -- --open

# Ask for confirmation before serving when config.js points to a non-local
# (production) grondona-url, to avoid accidentally hitting prod from dev.
confirm-local:
	@if grep -E "^[[:space:]]*'grondona-url'[[:space:]]*:" src/config.js | grep -Eqv "localhost|127\.0\.0\.1"; then \
		printf "⚠️  config.js 'grondona-url' is NOT local (pointing to production). Start anyway? [y/N] "; \
		read ans; \
		case "$$ans" in \
			[yY]|[yY][eE][sS]) echo "Continuing with production configuration..." ;; \
			*) echo "Aborted. Set 'grondona-url' to localhost (or confirm) before serving."; exit 1 ;; \
		esac; \
	fi

# Build targets
build:
	npm run build -- --configuration development

build-prod:
	npm run build -- --configuration production


# Rewrite the active (uncommented) 'grondona-url' line in src/config.js.
# A leading // keeps the commented prod line from matching the anchor.
config-prod:
	@perl -i -pe "s|^(\s*)'grondona-url'\s*:\s*'[^']*'|\$$1'grondona-url': '$(PROD_GRONDONA_URL)'|" src/config.js
	@echo "✓ config.js 'grondona-url' → $(PROD_GRONDONA_URL)"

config-local:
	@perl -i -pe "s|^(\s*)'grondona-url'\s*:\s*'[^']*'|\$$1'grondona-url': '$(LOCAL_GRONDONA_URL)'|" src/config.js
	@echo "✓ config.js 'grondona-url' → $(LOCAL_GRONDONA_URL)"

# Deploy: point config.js to prod, build & deploy, then always revert to local
# (the trap reverts even if the build or deploy fails / is interrupted).
deploy: install
	@$(MAKE) --no-print-directory config-prod
	@trap '$(MAKE) --no-print-directory config-local' EXIT INT TERM; \
	set -e; \
	npm run build -- --configuration production; \
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
