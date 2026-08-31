FROM python:3.12-slim

WORKDIR /app

COPY iot/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY common /app/common
COPY iot/worker.py /app/worker.py
COPY iot/simulator.py /app/simulator.py

ENV PYTHONUNBUFFERED=1
CMD ["python", "-u", "worker.py"]