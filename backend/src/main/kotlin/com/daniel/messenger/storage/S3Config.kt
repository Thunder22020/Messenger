package com.daniel.messenger.storage

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import java.net.URI

@Configuration
@EnableConfigurationProperties(S3Properties::class)
class S3Config(private val props: S3Properties) {
    @Bean
    fun s3Client(): S3Client = S3Client.builder()
        .region(Region.of(props.region))
        .endpointOverride(URI.create(props.endpoint))
        .credentialsProvider(
            StaticCredentialsProvider.create(
                AwsBasicCredentials.create(
                    props.accessKey,
                    props.secretKey
                )
            )
        )
        .forcePathStyle(true)
        .build()
}
