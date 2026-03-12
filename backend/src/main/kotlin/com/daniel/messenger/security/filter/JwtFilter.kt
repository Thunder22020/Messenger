package com.daniel.messenger.security.filter

import com.daniel.messenger.security.service.JwtService
import com.daniel.messenger.security.util.JwtConstants
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtFilter(
    private val jwtService: JwtService,
    private val userDetailsService: UserDetailsService
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        if (SecurityContextHolder.getContext().authentication != null) {
            filterChain.doFilter(request, response)
            return
        }

        val token = extractToken(request) ?: run {
            filterChain.doFilter(request, response)
            return
        }

        authenticate(token, request)

        filterChain.doFilter(request, response)
    }

    private fun extractToken(request: HttpServletRequest): String? {
        return request.getHeader(JwtConstants.AUTH_HEADER)
            ?.takeIf { it.startsWith(JwtConstants.BEARER_PREFIX) }
            ?.removePrefix(JwtConstants.BEARER_PREFIX)
    }

    private fun authenticate(token: String, request: HttpServletRequest) {
        val username = jwtService.extractUsername(token)
        val userDetails = userDetailsService.loadUserByUsername(username)

        if (!jwtService.validateToken(token, userDetails.username)) return

        val authToken = UsernamePasswordAuthenticationToken(
            userDetails,
            null,
            userDetails.authorities
        ).apply {
            details = WebAuthenticationDetailsSource().buildDetails(request)
        }

        SecurityContextHolder.getContext().authentication = authToken
    }
}