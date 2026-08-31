const BASE_URL = '';

class ApiError extends Error {
    constructor(message, status, details = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

export function getAuthToken() {
    return localStorage.getItem('token');
}

export function setAuthToken(token) {
    if (token) {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
}

export function getUsername() {
    return localStorage.getItem('username');
}

export function setUsername(username) {
    if (username) {
        localStorage.setItem('username', username);
    } else {
        localStorage.removeItem('username');
    }
}

export function logout() {
    setAuthToken(null);
    setUsername(null);
    window.dispatchEvent(new Event('auth-status-change'));
}

export async function request(method, path, body = null, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 12000); // 12-second default timeout

    const fetchOptions = {
        method,
        headers,
        signal: controller.signal,
    };

    // If body is FormData (e.g. for file upload), don't set Content-Type header
    if (body) {
        if (body instanceof FormData) {
            delete headers['Content-Type'];
            fetchOptions.body = body;
        } else {
            fetchOptions.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(`${BASE_URL}${path}`, fetchOptions);
        clearTimeout(timeoutId);

        if (response.status === 401) {
            logout();
            throw new ApiError('Your session has expired. Please sign in again.', 401);
        }

        let responseData = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        if (!response.ok) {
            const errorMessage = (responseData && responseData.error) || responseData.message || `Request failed with status ${response.status}`;
            throw new ApiError(errorMessage, response.status, responseData);
        }

        return responseData;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('This request timed out because the server took too long to respond. Please try again.');
        }
        if (error instanceof ApiError) {
            throw error;
        }
        throw new Error(error.message || 'A network error occurred. Please check your connection.');
    }
}
