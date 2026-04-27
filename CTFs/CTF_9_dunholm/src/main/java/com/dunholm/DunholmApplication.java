package com.dunholm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DunholmApplication {
    public static void main(String[] args) {
        SpringApplication.run(DunholmApplication.class, args);
    }
}
