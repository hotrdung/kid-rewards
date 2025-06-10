.PHONY: start build deploy

start:
	npm start -- --host 0.0.0.0

deploy:
	npm run build && firebase deploy --only hosting

help:
	@echo "Available commands:"
	@echo "  make start    - Starts the development server"
	@echo "  make deploy   - Deploys the project to Firebase Hosting"
