package com.daniel.messenger.presence

import java.time.Instant

data class PresenceEvent(
    val username: String,
    val online: Boolean,
    val lastSeenAt: Instant? = null,
)
