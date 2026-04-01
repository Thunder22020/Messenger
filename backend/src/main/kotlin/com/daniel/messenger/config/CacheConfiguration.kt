package com.daniel.messenger.config

import com.github.benmanes.caffeine.cache.Caffeine
import org.springframework.cache.CacheManager
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.caffeine.CaffeineCacheManager
import org.springframework.cache.support.CompositeCacheManager
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.data.redis.cache.RedisCacheConfiguration
import org.springframework.data.redis.cache.RedisCacheManager
import org.springframework.data.redis.connection.RedisConnectionFactory
import java.time.Duration
import java.util.concurrent.TimeUnit

@Configuration
@EnableCaching
@EnableScheduling
class CacheConfiguration {
    @Bean
    fun redisCacheManager(factory: RedisConnectionFactory): RedisCacheManager =
        RedisCacheManager.builder(factory)
            .withCacheConfiguration(
                "userDetails",
                RedisCacheConfiguration.defaultCacheConfig()
                    .entryTtl(Duration.ofSeconds(300))
            )
            .build()

    @Bean
    fun caffeineCacheManager(): CaffeineCacheManager =
        CaffeineCacheManager("chat-membership").apply {
            setCaffeine(
                Caffeine.newBuilder()
                    .expireAfterWrite(60, TimeUnit.SECONDS)
                    .maximumSize(50_000)
            )
        }

    @Bean
    @Primary
    fun cacheManager(
        caffeineCacheManager: CaffeineCacheManager,
        redisCacheManager: RedisCacheManager,
    ): CacheManager = CompositeCacheManager(caffeineCacheManager, redisCacheManager)
}
