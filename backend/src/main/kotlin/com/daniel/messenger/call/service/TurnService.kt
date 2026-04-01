package com.daniel.messenger.call.service

import com.daniel.messenger.call.dto.TurnCredentialsResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

@Service
class TurnService(
    @Value("\${app.turn.secret}") private val secret: String,
    @Value("\${app.turn.url}") private val url: String,
) {
    fun generateCredentials(userId: Long): TurnCredentialsResponse {
        val expiry = System.currentTimeMillis() / 1000 + 3600
        val username = "$expiry:$userId"
        val mac = Mac.getInstance("HmacSHA1")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA1"))
        val credential = Base64.getEncoder().encodeToString(mac.doFinal(username.toByteArray(Charsets.UTF_8)))
        return TurnCredentialsResponse(
            username = username,
            credential = credential,
            urls = listOf("turn:$url:3478", "turn:$url:3478?transport=tcp"),
        )
    }
}
