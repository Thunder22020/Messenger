package com.daniel.messenger.presence

data class PresenceEvent(
    val username: String,
    val online: Boolean,
)
