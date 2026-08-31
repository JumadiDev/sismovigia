FROM python:3.12-slim

WORKDIR /app

COPY ssn/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY common /app/common
COPY ssn/worker.py /app/worker.py

ENV PYTHONUNBUFFERED=1
CMD ["python", "-u", "worker.py"]