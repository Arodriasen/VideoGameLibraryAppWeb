import { describe, expect, it } from 'vitest';
import { ConnectionStringError, toNeonUrl } from './connectionString';

const HOST = 'ep-cool-1234-pooler.eu-central-1.aws.neon.tech';

describe('toNeonUrl', () => {
  it('convierte el formato Npgsql del escritorio', () => {
    expect(toNeonUrl(`Host=${HOST};Database=neondb;Username=owner;Password=abc123;SSL Mode=Require`)).toBe(
      `postgresql://owner:abc123@${HOST}/neondb?sslmode=require`,
    );
  });

  it('admite punto y coma final y claves en otro orden o mayúsculas', () => {
    expect(toNeonUrl(`PASSWORD=abc;USERNAME=owner;DATABASE=neondb;HOST=${HOST};`)).toBe(
      `postgresql://owner:abc@${HOST}/neondb?sslmode=require`,
    );
  });

  it('admite los sinónimos de Npgsql y el puerto', () => {
    expect(toNeonUrl(`Server=${HOST};Port=5432;Database=db;User Id=owner;Pwd=abc`)).toBe(
      `postgresql://owner:abc@${HOST}:5432/db?sslmode=require`,
    );
  });

  it('escapa los caracteres especiales de la contraseña', () => {
    const url = toNeonUrl(`Host=${HOST};Database=db;Username=owner;Password=a/b@c=d`);
    expect(url).toBe(`postgresql://owner:a%2Fb%40c%3Dd@${HOST}/db?sslmode=require`);
    expect(decodeURIComponent(new URL(url).password)).toBe('a/b@c=d');
  });

  it('respeta un punto y coma dentro de una contraseña entre comillas', () => {
    const url = toNeonUrl(`Host=${HOST};Database=db;Username=owner;Password='a;b''c';SSL Mode=Require`);
    expect(decodeURIComponent(new URL(url).password)).toBe("a;b'c");
  });

  it('deja tal cual una URL de Neon', () => {
    const url = `postgresql://owner:abc@${HOST}/neondb?sslmode=require`;
    expect(toNeonUrl(url)).toBe(url);
  });

  it('rechaza cadenas incompletas', () => {
    expect(() => toNeonUrl(`Host=${HOST};Database=db`)).toThrow(ConnectionStringError);
  });

  it('rechaza cualquier host que no sea de Neon', () => {
    expect(() => toNeonUrl('Host=interno.local;Database=db;Username=u;Password=p')).toThrow(ConnectionStringError);
    expect(() => toNeonUrl('postgresql://u:p@neon.tech.evil.com/db')).toThrow(ConnectionStringError);
  });
});
