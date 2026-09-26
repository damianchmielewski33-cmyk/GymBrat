package pl.gymbrat.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class UserContext {
    private UserContext() {}

    public static String requireUserId(HttpServletRequest request) {
        Object value = request.getAttribute(UserContextFilter.ATTR_USER_ID);
        if (value instanceof String s && !s.isBlank()) {
            return s;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Brak autoryzacji");
    }
}
