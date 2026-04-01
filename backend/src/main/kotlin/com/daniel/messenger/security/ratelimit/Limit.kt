package com.daniel.messenger.security.ratelimit

data class Limit(val max: Int, val windowSeconds: Long)
