package com.daniel.messenger.user.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class RegisterRequest(
    @field:NotBlank(message = "Username must not be blank")
    @field:Size(min = 3, max = 30, message = "Username must be between 3 and 30 characters")
    val username: String,

    @field:NotBlank(message = "Password must not be blank")
    @field:Size(min = 6, max = 72, message = "Password must be between 6 and 72 characters")
    val password: String,
)
