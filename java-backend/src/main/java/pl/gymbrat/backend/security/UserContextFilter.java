package pl.gymbrat.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Set;

/**
 * Next.js (BFF) przekazuje zalogowanego użytkownika nagłówkiem {@code X-GymBrat-User-Id}
 * oraz opcjonalnym {@code X-GymBrat-Proxy-Token}, gdy ustawiono {@code GYMBRAT_PROXY_TOKEN}.
 */
@Component
public class UserContextFilter extends OncePerRequestFilter {
    public static final String USER_ID_HEADER = "X-GymBrat-User-Id";
    public static final String PROXY_TOKEN_HEADER = "X-GymBrat-Proxy-Token";
    public static final String ATTR_USER_ID = "gymbrat.userId";

    private static final Set<String> PUBLIC_PREFIXES = Set.of(
            "/api/health",
            "/api/version",
            "/api/android/"
    );

    private final String expectedProxyToken;

    public UserContextFilter(@Value("${gymbrat.proxy-token:}") String expectedProxyToken) {
        this.expectedProxyToken = expectedProxyToken == null ? "" : expectedProxyToken.trim();
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        if ("OPTIONS".equalsIgnoreCase(request.getMethod()) || isPublic(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!expectedProxyToken.isEmpty()) {
            String token = request.getHeader(PROXY_TOKEN_HEADER);
            if (token == null || !constantTimeEquals(expectedProxyToken, token.trim())) {
                writeJsonError(response, HttpStatus.UNAUTHORIZED, "Nieprawidłowy token proxy.");
                return;
            }
        }

        String userId = request.getHeader(USER_ID_HEADER);
        if (userId == null || userId.isBlank()) {
            writeJsonError(response, HttpStatus.UNAUTHORIZED, "Brak autoryzacji");
            return;
        }
        request.setAttribute(ATTR_USER_ID, userId.trim());
        filterChain.doFilter(request, response);
    }

    private static boolean isPublic(String path) {
        if ("/".equals(path)) return true;
        for (String prefix : PUBLIC_PREFIXES) {
            if (path.equals(prefix) || path.startsWith(prefix)) return true;
        }
        return false;
    }

    private static void writeJsonError(HttpServletResponse response, HttpStatus status, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.getWriter().write("{\"ok\":false,\"error\":\"" + message.replace("\"", "'") + "\"}");
    }

    private static boolean constantTimeEquals(String a, String b) {
        byte[] left = a.getBytes(StandardCharsets.UTF_8);
        byte[] right = b.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(left, right);
    }
}
