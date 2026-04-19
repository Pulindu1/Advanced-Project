# syntax=docker/dockerfile:1.6

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-jammy AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

RUN mkdir -p /app/config /app/keys /app/logs /data/uploads /data/vault

COPY --from=build /build/target/trialvault.jar /app/trialvault.jar
COPY src/main/resources/application.properties /app/config/application.properties
COPY src/main/resources/keys/public.pem /app/keys/public.pem
COPY data/uploads/ /data/uploads/
COPY data/vault/ /data/vault/

EXPOSE 8080
ENV JAVA_TOOL_OPTIONS=""
ENTRYPOINT ["java","-jar","/app/trialvault.jar"]
