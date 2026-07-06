FROM grafana/alloy:v1.7.5
COPY alloy.config /etc/alloy/config.alloy
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 12345
ENTRYPOINT ["/entrypoint.sh"]
