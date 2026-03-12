package com.daniel.messenger.security.dto

data class SecurityTokens(
    val accessToken: String,
    val refreshToken: String
)