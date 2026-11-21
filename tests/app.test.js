const request = require('supertest');
const app = require('../app');

describe('GET /', () => {
  it('debe responder 200 con status "success" y un mensaje de bienvenida', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({
      status: 'success',
      message: expect.any(String),
    });
    expect(response.body.message.length).toBeGreaterThan(0);
  });
});

describe('GET /health', () => {
  it('debe responder 200 con { status: "UP" }', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ status: 'UP' });
  });
});

describe('Rutas desconocidas', () => {
  it('debe responder 404 en JSON', async () => {
    const response = await request(app).get('/no-existe');

    expect(response.status).toBe(404);
    expect(response.body.status).toBe('error');
  });
});
