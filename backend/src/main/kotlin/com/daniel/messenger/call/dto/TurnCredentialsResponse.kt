package com.daniel.messenger.call.dto

data class TurnCredentialsResponse(
    val username: String,
    val credential: String,
    val urls: List<String>,
)
