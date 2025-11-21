# AI Module Documentation

## External Dependencies

**Assistant API Backend**: The application may attempt to connect to `http://localhost:3007/api/assistant/...` for certain AI assistant functionality. This endpoint is served by an external backend service that is not included in this repository.

- **Status**: 500 errors at this endpoint indicate the backend service is not running or unavailable
- **Location**: External repository/service (not present in this codebase)
- **Required for**: Advanced AI assistant features (beyond basic cloud/local AI sculpting)

For full functionality, ensure the external assistant backend service is running and accessible at the expected endpoint.
