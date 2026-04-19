package com.dunholm.model;

import jakarta.persistence.*;

@Entity
@Table(name = "user_flags")
public class UserFlag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String username;

    @Column(name = "flag_index", nullable = false)
    private Integer flagIndex;

    @Column(name = "flag_value", nullable = false)
    private String flagValue;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public Integer getFlagIndex() { return flagIndex; }
    public void setFlagIndex(Integer flagIndex) { this.flagIndex = flagIndex; }
    public String getFlagValue() { return flagValue; }
    public void setFlagValue(String flagValue) { this.flagValue = flagValue; }
}
