# DAK API

This page provides the OpenAPI specification for the Digital Assurance Key (DAK) API used in the WHO SMART Trust Network.

The API defines how to exchange verification information for Digital Covid Certificates and trust network operations.

<div id="openapi-container">
<!-- OpenAPI Swagger UI will be embedded here -->
<iframe src="images/openapi/index.html" 
        width="100%" 
        height="800px" 
        frameborder="0">
  <p>Your browser does not support iframes. Please visit <a href="images/openapi/index.html">this link</a> to view the API documentation.</p>
</iframe>
</div>

## Key Features

- **Trust Certificate Management**: Upload, manage, and delete trusted certificates
- **Validation Rules**: Create and manage validation rules for certificate verification  
- **Trust Lists**: Access filtered lists of trusted certificates by type, country, and domain
- **Trusted References**: Manage trusted reference documents for the trust network
- **Value Sets**: Access available value sets for validation

## Authentication

All API endpoints require authentication via client certificates. The API uses mutual TLS (mTLS) for secure communication.

## Base URL

The API is available at the configured gateway endpoint for your environment.