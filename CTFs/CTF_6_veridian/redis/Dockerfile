FROM redis:7-alpine

COPY seed.sh /usr/local/bin/seed.sh
RUN chmod +x /usr/local/bin/seed.sh

ENTRYPOINT []
CMD ["/bin/sh", "/usr/local/bin/seed.sh"]
