package com.daniel.messenger.user.dto

data class UserSearchResponse(
    val id: Long,
    val username: String,
    val displayName: String? = null,
    val avatarUrl: String? = null,
)
