package com.daniel.messenger.push.service

import com.daniel.messenger.push.entity.PushSubscription
import com.daniel.messenger.push.repository.PushSubscriptionRepository
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy
import nl.martijndwars.webpush.Encoding
import nl.martijndwars.webpush.Notification
import nl.martijndwars.webpush.PushService
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import tools.jackson.databind.ObjectMapper
import java.security.Security
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

@Service
class PushNotificationService(
    private val pushSubscriptionRepository: PushSubscriptionRepository,
    private val objectMapper: ObjectMapper,
    @Value("\${app.vapid.public-key}") val vapidPublicKey: String,
    @Value("\${app.vapid.private-key}") private val vapidPrivateKey: String,
    @Value("\${app.vapid.subject}") private val vapidSubject: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val executor = Executors.newScheduledThreadPool(4)
    private val pending = ConcurrentHashMap<String, PendingBatch>()
    private lateinit var pushService: PushService

    private class PendingBatch(
        val title: String,
        val firstBody: String,
        val chatId: Long,
        var count: Int = 1,
        var future: ScheduledFuture<*>? = null,
    )

    @PostConstruct
    fun init() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(BouncyCastleProvider())
        }
        // Keys must be base64url WITHOUT padding — normalize in case they were stored
        // with standard base64 characters (+, /) or trailing = padding.
        val pubKey  = vapidPublicKey .trimEnd('=').replace('+', '-').replace('/', '_')
        val privKey = vapidPrivateKey.trimEnd('=').replace('+', '-').replace('/', '_')
        pushService = PushService(pubKey, privKey, vapidSubject)
    }

    @PreDestroy
    fun shutdown() {
        executor.shutdownNow()
    }

    fun saveSubscription(username: String, endpoint: String, p256dh: String, auth: String) {
        if (pushSubscriptionRepository.existsByEndpoint(endpoint)) return
        // Delete stale subscriptions from the same push service (same host) for this user
        // so old registrations don't accumulate when the PWA is reinstalled.
        val host = runCatching { java.net.URI(endpoint).let { "${it.scheme}://${it.host}" } }.getOrNull()
        if (host != null) {
            val stale = pushSubscriptionRepository.findByUsernameAndEndpointStartingWith(username, host)
            if (stale.isNotEmpty()) {
                pushSubscriptionRepository.deleteAll(stale)
            }
        }
        pushSubscriptionRepository.save(
            PushSubscription(username = username, endpoint = endpoint, p256dh = p256dh, auth = auth)
        )
    }

    fun deleteSubscription(endpoint: String) {
        pushSubscriptionRepository.deleteByEndpoint(endpoint)
    }

    /**
     * Debounces push notifications per (recipient, chat): waits 3 seconds after the
     * last message before delivering, so a burst of messages results in one push.
     */
    fun schedule(recipientUsername: String, chatId: Long, title: String, body: String) {
        val key = "$recipientUsername:$chatId"
        pending.compute(key) { _, existing ->
            existing?.future?.cancel(false)
            val batch = if (existing != null) {
                existing.also { it.count++ }
            } else {
                PendingBatch(title = title, firstBody = body, chatId = chatId)
            }
            batch.future = executor.schedule({
                pending.remove(key)
                deliver(recipientUsername, batch)
            }, 3, TimeUnit.SECONDS)
            batch
        }
    }

    private fun deliver(recipientUsername: String, batch: PendingBatch) {
        val subscriptions = pushSubscriptionRepository.findByUsername(recipientUsername)
        if (subscriptions.isEmpty()) return

        val body = if (batch.count == 1) batch.firstBody.take(120) else "${batch.count} new messages"
        val payload = objectMapper.writeValueAsBytes(
            mapOf("title" to batch.title, "body" to body, "chatId" to batch.chatId)
        )

        subscriptions.forEach { sub -> sendPush(sub, payload) }
    }

    private fun sendPush(sub: PushSubscription, payload: ByteArray) {
        try {
            val notification = Notification(sub.endpoint, sub.p256dh, sub.auth, payload)
            val response = pushService.send(notification, Encoding.AES128GCM)
            val statusCode = response.statusLine.statusCode
            if (statusCode == 404 || statusCode == 410) {
                pushSubscriptionRepository.delete(sub)
            }
        } catch (e: Exception) {
            log.warn("Push delivery error: {}", e.message)
        }
    }
}
