package com.daniel.messenger.push.repository

import com.daniel.messenger.push.entity.PushSubscription
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface PushSubscriptionRepository : JpaRepository<PushSubscription, Long> {
    fun findByUsername(username: String): List<PushSubscription>
    fun findByUsernameAndEndpointStartingWith(username: String, endpointPrefix: String): List<PushSubscription>
    fun deleteByEndpoint(endpoint: String)
    fun existsByEndpoint(endpoint: String): Boolean
}
